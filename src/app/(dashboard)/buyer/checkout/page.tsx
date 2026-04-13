'use client';

/**
 * Buyer Checkout Page — /buyer/checkout
 *
 * Two-column layout (desktop): shipping/billing form on the left,
 * order summary + pay button on the right. Stacks vertically on mobile.
 *
 * Flow:
 *   1. Load user profile → pre-fill name, phone, address
 *   2. Buyer fills / confirms shipping address, optional billing address, GST, notes
 *   3. Click "Pay ₹X,XXX" → validate form → POST /api/orders/create → open Razorpay modal
 *   4. Razorpay modal handles payment → calls handler on success
 *   5. Handler → POST /api/orders/verify-payment → clear cart → redirect to success page
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Lock,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useCartStore } from '@/stores/cartStore';
import { formatINR } from '@/lib/utils/formatting';
import { loadRazorpayScript, openRazorpayCheckout } from '@/lib/razorpay/checkout';
import type { RazorpaySuccessResponse } from '@/lib/razorpay/checkout';
import type { ShippingAddress } from '@/types';

// ---------------------------------------------------------------------------
// Address form shape
// ---------------------------------------------------------------------------

interface AddressFields {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_ADDRESS: AddressFields = {
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '',
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

interface FormErrors {
  shipping?: Partial<Record<keyof AddressFields, string>>;
  billing?: Partial<Record<keyof AddressFields, string>>;
  gstNumber?: string;
}

/**
 * Validates an address block. Returns an error map (empty = valid).
 */
function validateAddress(addr: AddressFields): Partial<Record<keyof AddressFields, string>> {
  const errs: Partial<Record<keyof AddressFields, string>> = {};
  if (!addr.name.trim()) errs.name = 'Contact name is required';
  if (!addr.phone.trim()) errs.phone = 'Phone number is required';
  if (!addr.line1.trim()) errs.line1 = 'Address line 1 is required';
  if (!addr.city.trim()) errs.city = 'City is required';
  if (!addr.state.trim()) errs.state = 'State is required';
  if (!addr.pincode.trim()) {
    errs.pincode = 'Pincode is required';
  } else if (!PINCODE_REGEX.test(addr.pincode.trim())) {
    errs.pincode = 'Enter a valid 6-digit pincode';
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Reusable address form sub-component
// ---------------------------------------------------------------------------

interface AddressFormProps {
  prefix: string;
  values: AddressFields;
  errors: Partial<Record<keyof AddressFields, string>>;
  onChange: (field: keyof AddressFields, value: string) => void;
}

/**
 * Renders the 7-field address form. `prefix` is used for unique html ids.
 */
function AddressForm({ prefix, values, errors, onChange }: AddressFormProps) {
  const inputClass = (field: keyof AddressFields) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${
      errors[field]
        ? 'border-rose-400 focus:ring-rose-400'
        : 'border-slate-300'
    }`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Contact Name */}
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-name`} className="block text-sm font-medium text-slate-700 mb-1">
          Contact Name <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Full name of the recipient"
          className={inputClass('name')}
          autoComplete="name"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.name}
          </p>
        )}
      </div>

      {/* Contact Phone */}
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-phone`} className="block text-sm font-medium text-slate-700 mb-1">
          Contact Phone <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-phone`}
          type="tel"
          value={values.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="+91 98765 43210"
          className={inputClass('phone')}
          autoComplete="tel"
        />
        {errors.phone && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.phone}
          </p>
        )}
      </div>

      {/* Address Line 1 */}
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-line1`} className="block text-sm font-medium text-slate-700 mb-1">
          Address Line 1 <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-line1`}
          type="text"
          value={values.line1}
          onChange={(e) => onChange('line1', e.target.value)}
          placeholder="Building name, street, locality"
          className={inputClass('line1')}
          autoComplete="address-line1"
        />
        {errors.line1 && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.line1}
          </p>
        )}
      </div>

      {/* Address Line 2 */}
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-line2`} className="block text-sm font-medium text-slate-700 mb-1">
          Address Line 2
          <span className="text-slate-400 font-normal ml-1">(optional)</span>
        </label>
        <input
          id={`${prefix}-line2`}
          type="text"
          value={values.line2}
          onChange={(e) => onChange('line2', e.target.value)}
          placeholder="Area, landmark, floor"
          className={inputClass('line2')}
          autoComplete="address-line2"
        />
      </div>

      {/* City */}
      <div>
        <label htmlFor={`${prefix}-city`} className="block text-sm font-medium text-slate-700 mb-1">
          City <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-city`}
          type="text"
          value={values.city}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder="Bangalore"
          className={inputClass('city')}
          autoComplete="address-level2"
        />
        {errors.city && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.city}
          </p>
        )}
      </div>

      {/* State */}
      <div>
        <label htmlFor={`${prefix}-state`} className="block text-sm font-medium text-slate-700 mb-1">
          State <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-state`}
          type="text"
          value={values.state}
          onChange={(e) => onChange('state', e.target.value)}
          placeholder="Karnataka"
          className={inputClass('state')}
          autoComplete="address-level1"
        />
        {errors.state && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.state}
          </p>
        )}
      </div>

      {/* Pincode */}
      <div>
        <label htmlFor={`${prefix}-pincode`} className="block text-sm font-medium text-slate-700 mb-1">
          Pincode <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefix}-pincode`}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={values.pincode}
          onChange={(e) => onChange('pincode', e.target.value.replace(/\D/g, ''))}
          placeholder="560001"
          className={inputClass('pincode')}
          autoComplete="postal-code"
        />
        {errors.pincode && (
          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.pincode}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------

/**
 * User profile shape returned by GET /api/auth/me
 */
interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export default function CheckoutPage() {
  const router = useRouter();

  // ── Cart store ────────────────────────────────────────────────────────────
  const {
    items,
    clearCart,
    getSubtotal,
    getGSTBreakdown,
    getDeliveryCharge,
    getGrandTotal,
  } = useCartStore();

  const subtotal = getSubtotal();
  const gstBreakdown = getGSTBreakdown();
  const deliveryCharge = getDeliveryCharge();
  const grandTotal = getGrandTotal();
  const gstAmount = gstBreakdown.reduce((s, g) => s + g.amount, 0);

  // ── User profile ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Shipping form ─────────────────────────────────────────────────────────
  const [useProfileAddress, setUseProfileAddress] = useState(false);
  const [shipping, setShipping] = useState<AddressFields>(EMPTY_ADDRESS);

  // ── Billing form ──────────────────────────────────────────────────────────
  const [sameBilling, setSameBilling] = useState(true);
  const [billing, setBilling] = useState<AddressFields>(EMPTY_ADDRESS);

  // ── Extra fields ──────────────────────────────────────────────────────────
  const [gstNumber, setGstNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // ── Order summary collapse ─────────────────────────────────────────────────
  const [showAllItems, setShowAllItems] = useState(false);

  // ── Form errors ───────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Payment state ─────────────────────────────────────────────────────────
  const [isPaying, setIsPaying] = useState(false);

  // ── Redirect if cart is empty ─────────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      router.replace('/buyer/cart');
    }
  }, [items.length, router]);

  // ── Load user profile ─────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not authenticated');
        const json = await res.json() as { user: UserProfile };
        setProfile(json.user);
        // Pre-fill name and phone from profile
        setShipping((prev) => ({
          ...prev,
          name: json.user.full_name ?? '',
          phone: json.user.phone ?? '',
        }));
      } catch {
        toast.error('Could not load your profile');
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // ── Auto-fill / clear profile address ────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    if (useProfileAddress) {
      setShipping({
        name: profile.full_name ?? '',
        phone: profile.phone ?? '',
        line1: profile.address_line1 ?? '',
        line2: profile.address_line2 ?? '',
        city: profile.city ?? 'Bangalore',
        state: profile.state ?? 'Karnataka',
        pincode: profile.pincode ?? '',
      });
    } else {
      // Only reset address fields — keep name/phone pre-fills
      setShipping((prev) => ({
        ...EMPTY_ADDRESS,
        name: prev.name,
        phone: prev.phone,
      }));
    }
  }, [useProfileAddress, profile]);

  // ── Shipping field updater ────────────────────────────────────────────────
  const updateShipping = useCallback((field: keyof AddressFields, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({
      ...prev,
      shipping: { ...prev.shipping, [field]: undefined },
    }));
  }, []);

  // ── Billing field updater ─────────────────────────────────────────────────
  const updateBilling = useCallback((field: keyof AddressFields, value: string) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({
      ...prev,
      billing: { ...prev.billing, [field]: undefined },
    }));
  }, []);

  // ── Validate entire form ──────────────────────────────────────────────────
  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    const shippingErrs = validateAddress(shipping);
    if (Object.keys(shippingErrs).length > 0) newErrors.shipping = shippingErrs;

    if (!sameBilling) {
      const billingErrs = validateAddress(billing);
      if (Object.keys(billingErrs).length > 0) newErrors.billing = billingErrs;
    }

    if (gstNumber.trim() && !GST_REGEX.test(gstNumber.trim().toUpperCase())) {
      newErrors.gstNumber = 'Invalid GST format — expected: 29XXXXX1234X1Z5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Build ShippingAddress from form ───────────────────────────────────────
  function toShippingAddress(fields: AddressFields): ShippingAddress {
    return {
      name: fields.name.trim(),
      phone: fields.phone.trim(),
      line1: fields.line1.trim(),
      line2: fields.line2.trim() || null,
      city: fields.city.trim(),
      state: fields.state.trim(),
      pincode: fields.pincode.trim(),
    };
  }

  // ── Payment handler ───────────────────────────────────────────────────────
  async function handlePay() {
    if (!validateForm()) {
      toast.error('Please fix the errors before proceeding');
      return;
    }

    setIsPaying(true);

    try {
      // Step 1: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Payment system not ready — please try again');
      }

      // Step 2: Create order in DB + Razorpay order on the server
      const createRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
          })),
          shipping_address: toShippingAddress(shipping),
          billing_address: sameBilling ? null : toShippingAddress(billing),
          gst_number: gstNumber.trim().toUpperCase() || null,
          notes: orderNotes.trim() || null,
        }),
      });

      const createJson = await createRes.json() as {
        data: {
          order_id: string;
          order_number: string;
          razorpay_order_id: string;
          razorpay_key: string;
          amount: number;
          currency: string;
          buyer_name: string;
          buyer_email: string | null;
          buyer_phone: string | null;
        } | null;
        error: string | null;
      };

      if (!createRes.ok || createJson.error || !createJson.data) {
        throw new Error(createJson.error ?? 'Failed to initiate payment');
      }

      const orderData = createJson.data;

      // Step 3: Open Razorpay modal
      openRazorpayCheckout({
        razorpay_key: orderData.razorpay_key,
        razorpay_order_id: orderData.razorpay_order_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_number: orderData.order_number,
        buyer_name: orderData.buyer_name,
        buyer_email: orderData.buyer_email ?? '',
        buyer_phone: orderData.buyer_phone ?? shipping.phone,
        onSuccess: async (response: RazorpaySuccessResponse) => {
          // Step 4: Verify payment signature on the server
          try {
            const verifyRes = await fetch('/api/orders/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderData.order_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyJson = await verifyRes.json() as {
              data: { success: boolean; order_number: string } | null;
              error: string | null;
            };

            if (!verifyRes.ok || verifyJson.error || !verifyJson.data?.success) {
              throw new Error(verifyJson.error ?? 'Payment verification failed');
            }

            // Step 5: Success — clear cart and go to success page
            clearCart();
            router.push(`/buyer/checkout/success?order_id=${orderData.order_id}`);
          } catch (err) {
            console.error('[checkout] verify-payment error:', err);
            toast.error(
              'Payment received but could not be confirmed. Contact support with payment ID: ' +
                response.razorpay_payment_id
            );
            setIsPaying(false);
          }
        },
        onDismiss: () => setIsPaying(false),
      });
    } catch (err) {
      console.error('[checkout] handlePay error:', err);
      toast.error(err instanceof Error ? err.message : 'Payment failed — please try again');
      setIsPaying(false);
    }
  }

  // ── Items to display in summary (max 3 unless expanded) ──────────────────
  const visibleItems = showAllItems ? items : items.slice(0, 3);
  const hiddenCount = items.length - 3;

  // ── Loading profile state ─────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm">Loading your details…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header */}
      <div className="mb-6">
        <Link
          href="/buyer/cart"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Cart
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN — Shipping + Billing + Notes
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col gap-6">

          {/* ── SHIPPING ADDRESS ────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">Shipping Address</h2>
            </div>

            {/* Use profile address toggle */}
            {profile?.address_line1 && (
              <label className="flex items-center gap-3 mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer hover:bg-teal-100 transition-colors">
                <input
                  type="checkbox"
                  checked={useProfileAddress}
                  onChange={(e) => setUseProfileAddress(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-teal-800 font-medium">
                  Use my profile address
                </span>
                <span className="text-xs text-teal-600 truncate">
                  — {profile.address_line1}, {profile.city}
                </span>
              </label>
            )}

            <AddressForm
              prefix="shipping"
              values={shipping}
              errors={errors.shipping ?? {}}
              onChange={updateShipping}
            />
          </section>

          {/* ── BILLING DETAILS ──────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">Billing Details</h2>
            </div>

            {/* Same as shipping toggle */}
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Same as shipping address
              </span>
            </label>

            {/* Separate billing form (shown when unchecked) */}
            {!sameBilling && (
              <div className="mt-2 pt-4 border-t border-slate-100">
                <AddressForm
                  prefix="billing"
                  values={billing}
                  errors={errors.billing ?? {}}
                  onChange={updateBilling}
                />
              </div>
            )}

            {/* GST Number */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label htmlFor="gst-number" className="block text-sm font-medium text-slate-700 mb-1">
                GST Number
                <span className="text-slate-400 font-normal ml-1">(optional — for tax invoice)</span>
              </label>
              <input
                id="gst-number"
                type="text"
                value={gstNumber}
                onChange={(e) => {
                  setGstNumber(e.target.value.toUpperCase());
                  setErrors((prev) => ({ ...prev, gstNumber: undefined }));
                }}
                placeholder="29XXXXX1234X1Z5"
                maxLength={15}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono transition-colors ${
                  errors.gstNumber ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {errors.gstNumber ? (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.gstNumber}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Format: 29XXXXX1234X1Z5 (state code + PAN + suffix)
                </p>
              )}
            </div>
          </section>

          {/* ── ORDER NOTES ──────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">Order Notes</h2>
              <span className="text-xs text-slate-400">(optional)</span>
            </div>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={3}
              placeholder="Any special instructions for this order? (e.g. delivery timing, fragile items, contact person)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none transition-colors"
            />
          </section>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Order Summary + Pay Button
        ═══════════════════════════════════════════════════════════════════ */}
        <aside className="lg:w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-20">

            <h2 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h2>

            {/* ── Items list ──────────────────────────────────────────── */}
            <div className="divide-y divide-slate-100 mb-4">
              {visibleItems.map((item) => (
                <div key={item.product_id} className="py-2.5 flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium leading-tight truncate">
                      {item.product_name}
                    </p>
                    {item.brand && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.brand}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.quantity} × {formatINR(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {formatINR(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Show more / less toggle */}
            {items.length > 3 && (
              <button
                onClick={() => setShowAllItems((v) => !v)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium mb-3 transition-colors"
              >
                {showAllItems ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show fewer items
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    and {hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}

            {/* ── Price breakdown ──────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-mono text-slate-800">{formatINR(subtotal)}</span>
              </div>

              {gstBreakdown.map(({ rate, amount }) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-slate-600">GST {rate}%</span>
                  <span className="font-mono text-slate-700">{formatINR(amount)}</span>
                </div>
              ))}

              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Delivery</span>
                {deliveryCharge === 0 ? (
                  <span className="font-mono font-medium text-emerald-600">FREE</span>
                ) : (
                  <span className="font-mono text-slate-700">{formatINR(deliveryCharge)}</span>
                )}
              </div>
            </div>

            {/* Grand total */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
              <span className="font-semibold text-slate-900 text-base">Total</span>
              <span className="font-mono text-xl font-bold text-teal-600">
                {formatINR(grandTotal)}
              </span>
            </div>

            {/* ── Pay button ────────────────────────────────────────────── */}
            <button
              onClick={handlePay}
              disabled={isPaying || items.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 text-white rounded-lg font-semibold text-base hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Processing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Pay {formatINR(grandTotal)}
                </>
              )}
            </button>

            {/* Security badge */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
              Secure payment powered by Razorpay
            </div>

            {/* Payment method logos (text badges) */}
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              {['Visa', 'Mastercard', 'UPI', 'Net Banking'].map((method) => (
                <span
                  key={method}
                  className="px-2 py-0.5 text-xs border border-slate-200 rounded text-slate-500 bg-slate-50"
                >
                  {method}
                </span>
              ))}
            </div>

            {/* Back to cart */}
            <div className="mt-4 text-center">
              <Link
                href="/buyer/cart"
                className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
              >
                ← Back to Cart
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
