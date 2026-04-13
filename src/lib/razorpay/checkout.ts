/**
 * Razorpay checkout utilities — CLIENT-SIDE ONLY.
 *
 * loadRazorpayScript(): Injects checkout.js into the DOM (idempotent).
 * openRazorpayCheckout(): Opens the Razorpay payment modal.
 */

// ---------------------------------------------------------------------------
// Window type for Razorpay checkout.js global
// ---------------------------------------------------------------------------

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

// ---------------------------------------------------------------------------
// Script loader — idempotent (safe to call multiple times)
// ---------------------------------------------------------------------------

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }
    if (document.getElementById('razorpay-script')) { resolve(true); return; }

    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Open checkout modal
// ---------------------------------------------------------------------------

export interface RazorpayCheckoutOptions {
  razorpay_key: string;
  razorpay_order_id: string;
  amount: number;       // paise
  currency: string;
  order_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onDismiss: () => void;
}

export function openRazorpayCheckout(options: RazorpayCheckoutOptions): void {
  const rzp = new window.Razorpay({
    key: options.razorpay_key,
    amount: options.amount,
    currency: options.currency,
    name: 'Primeserve',
    description: `Order ${options.order_number}`,
    order_id: options.razorpay_order_id,
    prefill: {
      name: options.buyer_name,
      email: options.buyer_email,
      contact: options.buyer_phone,
    },
    theme: { color: '#0d9488' }, // teal-600
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
  });
  rzp.open();
}
