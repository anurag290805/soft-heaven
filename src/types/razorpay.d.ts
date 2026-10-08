interface RazorpayCheckoutResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
  handler: (response: RazorpayCheckoutResponse) => void
}

interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: 'payment.failed', handler: () => void) => void
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance
}

interface Window {
  Razorpay?: RazorpayConstructor
}
