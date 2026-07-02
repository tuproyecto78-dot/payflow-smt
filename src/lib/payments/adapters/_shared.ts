// Shared helpers used by all payment adapters.

import {
  type CreatePaymentInput,
  type NormalizedPaymentResult,
  type PaymentMode,
  type PaymentProvider,
  type PaymentStatus,
  type ProviderConfigStatus,
  normalizeStatus,
} from "../types";
import { t, type Language } from "@/lib/i18n/strings";

export type AdapterBase = {
  payment_amount: number;
  payment_currency: string;
  order_id: string;
};

export interface AdapterContext {
  input: CreatePaymentInput;
  base: AdapterBase;
}

// Currency × provider compatibility.
const PROVIDER_CURRENCY_SUPPORT: Record<PaymentProvider, string[]> = {
  Mock: ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL", "GBP", "JPY"],
  PayPhone: ["USD"],
  DEUNA: ["USD", "MXN", "COP", "PEN", "CLP", "BRL"],
  Stripe: ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL", "GBP", "JPY"],
  PayPal: ["USD", "EUR", "MXN", "BRL", "GBP", "JPY", "ARS", "CLP"],
  "Mercado Pago": ["USD", "MXN", "COP", "PEN", "CLP", "ARS", "BRL"],
  "API personalizada": ["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "BRL", "GBP", "JPY"],
};

export function isPaymentSupportedByProvider(currency: string, provider: PaymentProvider): boolean {
  const list = PROVIDER_CURRENCY_SUPPORT[provider] || ["USD"];
  return list.includes(currency.toUpperCase());
}

// WhatsApp message helpers (used by adapters that emit a message).
export function whatsappMessageForStatus(
  status: PaymentStatus,
  lang: Language = "es"
): string {
  switch (status) {
    case "payment_success":
      return t("payment.success", lang);
    case "payment_failed":
      return t("payment.failed", lang);
    case "payment_pending":
      return t("payment.pending", lang);
    case "error":
      return t("payment.error", lang);
  }
}

// Provider-specific "link sent" message used when a link/checkout provider
// creates a payment and the status is payment_pending.
//   - Stripe  → "Te enviamos tu enlace seguro de pago..."
//   - PayPal  → "Te enviamos el enlace para completar tu pago con PayPal..."
//   - DEUNA, Mercado Pago, API personalizada → generic link message
export function whatsappMessageForLink(
  provider: PaymentProvider = "DEUNA",
  lang: Language = "es"
): string {
  if (provider === "Stripe") return t("payment.link_pending.stripe", lang);
  if (provider === "PayPal") return t("payment.link_pending.paypal", lang);
  return t("payment.link_pending", lang);
}

// Outcome message for the "payment_pending" WhatsApp result node.
//   - PayPhone          → "⏳ Tu pago está pendiente de confirmación en PayPhone."
//   - Link/checkout     → "⏳ Tu pago está pendiente de confirmación. Puedes completar el pago aquí: {{payment_link}}"
//   - Mock / direct     → "⏳ Tu pago está pendiente de confirmación. Te avisaremos cuando sea aprobado."
export function whatsappMessageForPendingOutcome(
  provider: PaymentProvider,
  mode: PaymentMode,
  lang: Language = "es"
): string {
  if (provider === "PayPhone") return t("payphone.pending", lang);
  if (mode === "link" || mode === "checkout") {
    return t("payment.pending_with_link", lang);
  }
  return t("payment.pending", lang);
}

export function whatsappMessageForPayphoneSale(lang: Language = "es"): string {
  return t("payphone.sale_created", lang);
}

// Build a normalized result with sensible defaults.
export function buildResult(args: {
  payment_id: string;
  provider: PaymentProvider;
  provider_payment_id: string | null;
  payment_status: PaymentStatus;
  payment_link: string;
  input: CreatePaymentInput;
  base: AdapterBase;
  mode?: PaymentMode;
  raw_response: Record<string, unknown>;
  whatsapp_message?: string;
  extras?: Record<string, unknown>;
}): NormalizedPaymentResult {
  return {
    payment_id: args.payment_id,
    provider: args.provider,
    provider_payment_id: args.provider_payment_id,
    payment_status: args.payment_status,
    payment_link: args.payment_link,
    amount: args.base.payment_amount,
    currency: args.base.payment_currency,
    order_id: args.base.order_id,
    raw_response: args.raw_response,
    mode: args.mode || args.input.mode || "direct",
    whatsapp_message: args.whatsapp_message,
    ...args.extras,
  };
}

// Shared fetch helper that catches network errors and never throws.
export async function safeFetch(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; error?: string }> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { _raw: text } : null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { normalizeStatus };
export type { CreatePaymentInput, NormalizedPaymentResult, PaymentProvider, PaymentStatus, PaymentMode, ProviderConfigStatus };
