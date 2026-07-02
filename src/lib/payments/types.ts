// Payment Provider Adapter — shared types.
// All adapters return the same NormalizedPaymentResult shape so the workflow
// engine and frontend never depend on provider-specific fields.

export type PaymentProvider =
  | "Mock"
  | "PayPhone"
  | "DEUNA"
  | "Stripe"
  | "PayPal"
  | "Mercado Pago"
  | "API personalizada";

export type PaymentStatus =
  | "payment_success"
  | "payment_failed"
  | "payment_pending"
  | "error";

export type PaymentMode = "direct" | "link" | "checkout";
// "direct"  → sin link / solicitud directa (PayPhone API Sale, Mock)
// "link"    → link de pago (DEUNA Payment Link, API personalizada con link)
// "checkout"→ checkout externo (Stripe Checkout Session, PayPal Orders, MP Preference)

export interface CreatePaymentInput {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  description: string;
  customer: string;
  phoneNumber: string;
  orderId: string;
  userId: string;
  clientId?: string;
  workflowId?: string;
  workflowRunId?: string;
  mode?: PaymentMode;
  // Provider-specific options
  customApiUrl?: string;
  customApiHeaders?: Record<string, string>;
  customApiBodyTemplate?: string;
  customApiStatusMapping?: Record<string, PaymentStatus>;
  forceOutcome?: PaymentStatus; // Mock only
  payphoneIntegration?: "API Sale" | "API Link";
  countryCode?: string;
  customerDocument?: string;
  reference?: string;
  language?: "es" | "en";
}

export interface NormalizedPaymentResult {
  payment_id: string;
  provider: PaymentProvider;
  provider_payment_id: string | null;
  payment_status: PaymentStatus;
  payment_link: string;
  amount: number;
  currency: string;
  order_id: string;
  raw_response: Record<string, unknown>;
  mode: PaymentMode;
  // Optional provider-specific extras (NOT relied on by the workflow engine)
  whatsapp_message?: string;
  payphone_business_status?: string;
  payphone_store_id?: string | null;
  payphone_personal_status?: string;
  customer_phone?: string;
  customer_document?: string;
  customer_name?: string;
  country_code?: string;
  currency_warning?: string;
}

export interface ProviderConfigStatus {
  provider: PaymentProvider;
  configured: boolean;
  mode: "sandbox" | "production";
  missingVars: string[];
}

// The 4 normalized statuses PayFlow SMT recognizes.
export const NORMALIZED_STATUSES: PaymentStatus[] = [
  "payment_success",
  "payment_failed",
  "payment_pending",
  "error",
];

// Convert any provider's raw status string into one of the 4 normalized statuses.
export function normalizeStatus(raw: unknown): PaymentStatus {
  if (typeof raw !== "string") return "payment_pending";
  const s = raw.toLowerCase();
  // success
  if (
    [
      "payment_success",
      "succeeded",
      "approved",
      "paid",
      "completed",
      "success",
      "captured",
      "settled",
      "active",
    ].includes(s)
  )
    return "payment_success";
  // failed
  if (
    [
      "payment_failed",
      "failed",
      "declined",
      "rejected",
      "canceled",
      "cancelled",
      "denied",
      "voided",
    ].includes(s)
  )
    return "payment_failed";
  if (s === "error") return "error";
  // everything else (pending, processing, waiting, requires_action, in_progress, etc.)
  return "payment_pending";
}

export function isPaymentProvider(v: unknown): v is PaymentProvider {
  return (
    typeof v === "string" &&
    [
      "Mock",
      "PayPhone",
      "DEUNA",
      "Stripe",
      "PayPal",
      "Mercado Pago",
      "API personalizada",
    ].includes(v)
  );
}

export function parseProvider(v: unknown): PaymentProvider {
  return isPaymentProvider(v) ? v : "Mock";
}

export function parseMode(v: unknown): PaymentMode {
  if (v === "direct" || v === "link" || v === "checkout") return v;
  return "direct";
}
