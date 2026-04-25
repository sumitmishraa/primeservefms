'use client';

/**
 * Buyer Checkout Page — /buyer/checkout
 *
 * Two-column layout (desktop): form on the left, order summary + pay on the right.
 *
 * Flow (instant payment):
 *   1. Load profile → pre-fill name, phone, company, GST, PAN, saved addresses
 *   2. Buyer picks shipping address + payment method
 *   3. Click "Place Order" → validate → POST /api/orders/create { payment_method: 'razorpay' }
 *   4. Razorpay modal opens → on success → POST /api/orders/verify-payment
 *   5. Clear cart → redirect to /buyer/checkout/success
 *
 * Flow (45-day credit):
 *   Steps 1–2 same, then:
 *   3. Click "Place Order" → validate → POST /api/orders/create { payment_method: 'credit_45day' }
 *   4. Server checks credit account, deducts used_amount
 *   5. Clear cart → redirect to /buyer/checkout/success
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
  Building2,
  Zap,
  Clock,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useCartStore } from '@/stores/cartStore';
import { formatINR } from '@/lib/utils/formatting';
import { loadRazorpayScript, openRazorpayCheckout } from '@/lib/razorpay/checkout';
import type { RazorpaySuccessResponse } from '@/lib/razorpay/checkout';
import type { ShippingAddress } from '@/types';

// ---------------------------------------------------------------------------
// Local types
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

interface SavedAddress {
  id: string;
  label: string;
  contact_name: string;
  contact_phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface BuyerProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  gst_number: string | null;
  tax_id: string | null;
  client_name: string | null;
  branch_name: string | null;
  saved_addresses: SavedAddress[] | null;
}

interface CreditAccount {
  id: string | null;
  credit_limit: number;
  used_amount: number;
  available: number;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

interface FormErrors {
  shipping?: Partial<Record<keyof AddressFields, string>>;
  billing?: Partial<Record<keyof AddressFields, string>>;
  gstNumber?: string;
}

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
// AddressForm sub-component
// ---------------------------------------------------------------------------

interface AddressFormProps {
  prefix: string;
  values: AddressFields;
  errors: Partial<Record<keyof AddressFields, string>>;
  onChange: (field: keyof AddressFields, value: string) => void;
}

function AddressForm({ prefix, values, errors, onChange }: AddressFormProps) {
  const inputClass = (field: keyof AddressFields) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${
      errors[field] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300'
    }`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.name}
          </p>
        )}
      </div>

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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.phone}
          </p>
        )}
      </div>

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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.line1}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-line2`} className="block text-sm font-medium text-slate-700 mb-1">
          Address Line 2 <span className="text-slate-400 font-normal ml-1">(optional)</span>
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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.city}
          </p>
        )}
      </div>

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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.state}
          </p>
        )}
      </div>

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
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.pincode}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const router = useRouter();

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

  // ── Data loading ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [credit, setCredit] = useState<CreditAccount | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Shipping form ─────────────────────────────────────────────────────────
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shipping, setShipping] = useState<AddressFields>(EMPTY_ADDRESS);

  // ── Billing form ──────────────────────────────────────────────────────────
  const [sameBilling, setSameBilling] = useState(true);
  const [billing, setBilling] = useState<AddressFields>(EMPTY_ADDRESS);

  // ── Extra fields ──────────────────────────────────────────────────────────
  const [gstNumber, setGstNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // ── Payment method ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'credit_45day'>('razorpay');

  // ── Order summary collapse ─────────────────────────────────────────────────
  const [showAllItems, setShowAllItems] = useState(false);

  // ── Form errors ───────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Payment state ─────────────────────────────────────────────────────────
  const [isPlacing, setIsPlacing] = useState(false);

  // ── Redirect if cart is empty ─────────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      router.replace('/buyer/cart');
    }
  }, [items.length, router]);

  // ── Load profile + credit account in parallel ─────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, creditRes] = await Promise.all([
          fetch('/api/buyer/profile'),
          fetch('/api/buyer/credit'),
        ]);

        if (!profileRes.ok) throw new Error('Not authenticated');

        const profileJson = await profileRes.json() as { data: BuyerProfile | null; error: string | null };
        if (!profileJson.data) throw new Error(profileJson.error ?? 'Failed to load profile');

        const p = profileJson.data;
        setProfile(p);

        setShipping((prev) => ({
          ...prev,
          name: p.full_name ?? '',
          phone: p.phone ?? '',
        }));

        if (p.gst_number) setGstNumber(p.gst_number);

        const addrs = p.saved_addresses ?? [];
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.is_default) ?? addrs[0];
          setSelectedAddressId(def.id);
        }

        if (creditRes.ok) {
          const creditJson = await creditRes.json() as { data: CreditAccount | null; error: string | null };
          if (creditJson.data) setCredit(creditJson.data);
        }
      } catch {
        toast.error('Could not load your details');
      } finally {
        setProfileLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Sync selected saved address into shipping form ────────────────────────
  useEffect(() => {
    if (!profile) return;
    const addrs = profile.saved_addresses ?? [];
    if (selectedAddressId) {
      const picked = addrs.find((a) => a.id === selectedAddressId);
      if (picked) {
        setShipping({
          name: picked.contact_name || profile.full_name || '',
          phone: picked.contact_phone || profile.phone || '',
          line1: picked.line1,
          line2: picked.line2,
          city: picked.city,
          state: picked.state,
          pincode: picked.pincode,
        });
        setErrors((prev) => ({ ...prev, shipping: undefined }));
      }
    } else {
      setShipping((prev) => ({
        ...EMPTY_ADDRESS,
        name: prev.name || profile.full_name || '',
        phone: prev.phone || profile.phone || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddressId, profile]);

  const updateShipping = useCallback((field: keyof AddressFields, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, shipping: { ...prev.shipping, [field]: undefined } }));
  }, []);

  const updateBilling = useCallback((field: keyof AddressFields, value: string) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, billing: { ...prev.billing, [field]: undefined } }));
  }, []);

  // ── Validate form ─────────────────────────────────────────────────────────
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

  // ── Place order ───────────────────────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!validateForm()) {
      toast.error('Please fix the errors before proceeding');
      return;
    }

    // Credit-specific guard before making the API call
    if (paymentMethod === 'credit_45day') {
      if (!credit || credit.status !== 'active') {
        toast.error('Your credit account is not active. Please choose instant payment.');
        return;
      }
      if (credit.available < grandTotal) {
        toast.error(
          `Insufficient credit. Available: ${formatINR(credit.available)}, Required: ${formatINR(grandTotal)}`
        );
        return;
      }
    }

    setIsPlacing(true);

    try {
      const orderPayload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
        })),
        shipping_address: toShippingAddress(shipping),
        billing_address: sameBilling ? null : toShippingAddress(billing),
        gst_number: gstNumber.trim().toUpperCase() || null,
        notes: orderNotes.trim() || null,
        payment_method: paymentMethod,
      };

      // ── Instant payment: Razorpay modal flow ────────────────────────────────
      if (paymentMethod === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded || typeof window.Razorpay === 'undefined') {
          throw new Error('Payment system not ready — please try again');
        }

        const createRes = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        const createJson = await createRes.json() as {
          data: {
            order_id: string;
            order_number: string;
            payment_method: 'razorpay';
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

        const od = createJson.data;

        openRazorpayCheckout({
          razorpay_key: od.razorpay_key,
          razorpay_order_id: od.razorpay_order_id,
          amount: od.amount,
          currency: od.currency,
          order_number: od.order_number,
          buyer_name: od.buyer_name,
          buyer_email: od.buyer_email ?? '',
          buyer_phone: od.buyer_phone ?? shipping.phone,
          onSuccess: async (response: RazorpaySuccessResponse) => {
            try {
              const verifyRes = await fetch('/api/orders/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: od.order_id,
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

              clearCart();
              router.push(`/buyer/checkout/success?order_id=${od.order_id}`);
            } catch (err) {
              console.error('[checkout] verify-payment error:', err);
              toast.error(
                'Payment received but could not be confirmed. Contact support with payment ID: ' +
                  response.razorpay_payment_id
              );
              setIsPlacing(false);
            }
          },
          onDismiss: () => setIsPlacing(false),
        });

        return; // setIsPlacing stays true until modal resolves
      }

      // ── 45-day credit flow ──────────────────────────────────────────────────
      const createRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const createJson = await createRes.json() as {
        data: { order_id: string; order_number: string } | null;
        error: string | null;
      };

      if (!createRes.ok || createJson.error || !createJson.data) {
        throw new Error(createJson.error ?? 'Failed to place order');
      }

      clearCart();
      router.push(`/buyer/checkout/success?order_id=${createJson.data.order_id}`);
    } catch (err) {
      console.error('[checkout] handlePlaceOrder error:', err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong — please try again');
      setIsPlacing(false);
    }
  }

  const visibleItems = showAllItems ? items : items.slice(0, 3);
  const hiddenCount = items.length - 3;
  const creditAvailable = credit?.status === 'active' && (credit?.available ?? 0) >= grandTotal;

  // ── Loading state ─────────────────────────────────────────────────────────
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
            LEFT COLUMN
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col gap-6">

          {/* ── COMPANY DETAILS (read-only autofill) ─────────────────────── */}
          {(profile?.company_name || profile?.gst_number || profile?.tax_id) && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-teal-600" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Company Details</h2>
                <span className="text-xs text-slate-400 ml-auto">
                  From your{' '}
                  <Link href="/buyer/profile" className="text-teal-600 hover:underline">
                    profile
                  </Link>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.company_name && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Company Name</p>
                    <p className="text-sm text-slate-800 font-medium">{profile.company_name}</p>
                  </div>
                )}
                {profile.gst_number && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">GST Number</p>
                    <p className="text-sm text-slate-800 font-mono">{profile.gst_number}</p>
                  </div>
                )}
                {profile.tax_id && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">PAN</p>
                    <p className="text-sm text-slate-800 font-mono">{profile.tax_id}</p>
                  </div>
                )}
                {profile.client_name && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Client</p>
                    <p className="text-sm text-slate-800">{profile.client_name}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── SHIPPING ADDRESS ────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">Shipping Address</h2>
            </div>

            {(profile?.saved_addresses?.length ?? 0) > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Use a saved address
                </p>
                <div className="space-y-2">
                  {(profile!.saved_addresses ?? []).map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selectedAddressId === addr.id
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{addr.label}</p>
                          {addr.is_default && (
                            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {addr.contact_name} · {addr.contact_phone}
                        </p>
                        <p className="text-xs text-slate-500">
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city},{' '}
                          {addr.state} {addr.pincode}
                        </p>
                      </div>
                    </label>
                  ))}

                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      selectedAddressId === null
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      checked={selectedAddressId === null}
                      onChange={() => setSelectedAddressId(null)}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Enter a new address</span>
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Manage saved addresses in your{' '}
                  <Link href="/buyer/profile" className="text-teal-600 hover:underline">
                    profile
                  </Link>
                  .
                </p>
              </div>
            )}

            {(profile?.saved_addresses?.length ?? 0) === 0 && (
              <p className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                Tip: save addresses in your{' '}
                <Link href="/buyer/profile" className="text-teal-600 hover:underline">
                  profile
                </Link>{' '}
                to skip this step on future orders.
              </p>
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

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-slate-700">Same as shipping address</span>
            </label>

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

            {/* GST override (if not on profile or buyer wants a different number) */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label
                htmlFor="gst-number"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                GST Number
                <span className="text-slate-400 font-normal ml-1">
                  (optional — for tax invoice)
                </span>
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
                <p className="mt-1 text-xs text-slate-400">Format: 29XXXXX1234X1Z5</p>
              )}
            </div>
          </section>

          {/* ── PAYMENT METHOD ───────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Payment Method</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Instant payment card */}
              <label
                className={`flex flex-col gap-2 rounded-xl border p-4 cursor-pointer transition-colors ${
                  paymentMethod === 'razorpay'
                    ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-400'
                    : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 shrink-0"
                  />
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-teal-600" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-800">Pay Now</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 pl-7">
                  Instant payment via Razorpay. Order confirmed immediately.
                </p>
                <div className="flex flex-wrap gap-1.5 pl-7 pt-1">
                  {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallets'].map((m) => (
                    <span
                      key={m}
                      className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white text-slate-500"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </label>

              {/* 45-day credit card */}
              <label
                className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
                  credit?.status === 'active'
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-60'
                } ${
                  paymentMethod === 'credit_45day'
                    ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                    : 'border-slate-200 hover:border-amber-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'credit_45day'}
                    onChange={() => {
                      if (credit?.status === 'active') setPaymentMethod('credit_45day');
                    }}
                    disabled={credit?.status !== 'active'}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500 shrink-0"
                  />
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-800">45-Day Credit</span>
                  </div>
                </div>

                {credit?.status === 'active' ? (
                  <>
                    <p className="text-xs text-slate-500 pl-7">
                      Pay within 45 days of delivery. No interest.
                    </p>
                    <div className="pl-7 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Credit limit</span>
                        <span className="font-mono font-medium text-slate-700">
                          {formatINR(credit.credit_limit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Used</span>
                        <span className="font-mono text-slate-600">
                          {formatINR(credit.used_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Available</span>
                        <span
                          className={`font-mono font-semibold ${
                            creditAvailable ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          {formatINR(credit.available)}
                        </span>
                      </div>
                      {!creditAvailable && (
                        <p className="text-xs text-rose-600 flex items-center gap-1 pt-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          Insufficient credit for this order ({formatINR(grandTotal)} required)
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="pl-7">
                    <p className="text-xs text-slate-500 mb-1">
                      {credit?.status === 'suspended'
                        ? 'Your credit account is suspended.'
                        : 'Credit not activated for your account.'}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Info className="w-3 h-3 shrink-0" />
                      Contact your account manager to enable credit.
                    </p>
                  </div>
                )}
              </label>
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
              placeholder="Any special instructions? (delivery timing, fragile items, contact person)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none transition-colors"
            />
          </section>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Order Summary + Place Order
        ═══════════════════════════════════════════════════════════════════ */}
        <aside className="lg:w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-20">

            <h2 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h2>

            {/* Items */}
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

            {items.length > 3 && (
              <button
                onClick={() => setShowAllItems((v) => !v)}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium mb-3 transition-colors"
              >
                {showAllItems ? (
                  <><ChevronUp className="w-3 h-3" />Show fewer items</>
                ) : (
                  <><ChevronDown className="w-3 h-3" />and {hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}</>
                )}
              </button>
            )}

            {/* Price breakdown */}
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

            {/* Payment method summary */}
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
              {paymentMethod === 'razorpay' ? (
                <>
                  <Zap className="w-3 h-3 text-teal-600 shrink-0" />
                  Pay now via Razorpay (UPI / Card / Net Banking)
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  45-day credit — payment due after delivery
                </>
              )}
            </div>

            {/* Place order button */}
            <button
              onClick={handlePlaceOrder}
              disabled={
                isPlacing ||
                items.length === 0 ||
                (paymentMethod === 'credit_45day' && !creditAvailable)
              }
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 text-white rounded-lg font-semibold text-base hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPlacing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {paymentMethod === 'razorpay' ? 'Opening payment…' : 'Placing order…'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {paymentMethod === 'razorpay'
                    ? `Pay ${formatINR(grandTotal)}`
                    : `Place Order — ${formatINR(grandTotal)}`}
                </>
              )}
            </button>

            {/* Security / trust line */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {paymentMethod === 'razorpay'
                ? 'Secure payment powered by Razorpay'
                : 'Order placed on your approved credit line'}
            </div>

            {paymentMethod === 'razorpay' && (
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
            )}

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
