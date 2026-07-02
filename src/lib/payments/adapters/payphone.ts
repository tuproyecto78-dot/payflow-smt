// PayPhone adapter — uses API Sale (recommended) or API Link.
// Backend-only: PAYPHONE_TOKEN and PAYPHONE_STORE_ID never reach the frontend.

import {
  type CreatePaymentInput,
  type NormalizedPaymentResult,
  type PaymentStatus,
} from "../types";
import {
  type AdapterBase,
  buildResult,
  normalizeStatus,
  safeFetch,
  whatsappMessageForPayphoneSale,
  whatsappMessageForStatus,
} from "./_shared";

const PAYPHONE_MSG_KEYS = {
  business_not_configured: "payphone.business_not_configured",
  customer_not_registered: "payphone.customer_not_registered",
  success: "payphone.success",
  failed: "payphone.failed",
  pending: "payphone.pending",
  error: "payphone.error",
} as const;

function msg(key: keyof typeof PAYPHONE_MSG_KEYS, lang: "es" | "en" = "es"): string {
  // dynamic import would be async; use the t() import directly
  // _shared already imports t but doesn't re-export it; inline minimal map here
  const ES: Record<string, string> = {
    "payphone.business_not_configured":
      "El comercio aún no tiene PayPhone Business configurado.",
    "payphone.customer_not_registered":
      "No encontramos este número registrado en PayPhone. Verifica el número o usa otro método de pago.",
    "payphone.success": "✅ Tu pago fue confirmado correctamente. Gracias por tu compra.",
    "payphone.failed": "❌ El pago fue rechazado o no pudo completarse.",
    "payphone.pending": "⏳ Tu pago está pendiente de confirmación en PayPhone.",
    "payphone.error": "⚠️ Ocurrió un error procesando el pago.",
  };
  const EN: Record<string, string> = {
    "payphone.business_not_configured":
      "The merchant does not have PayPhone Business configured yet.",
    "payphone.customer_not_registered":
      "We couldn't find this number registered in PayPhone. Verify the number or use another payment method.",
    "payphone.success": "✅ Your payment was confirmed successfully. Thank you for your purchase.",
    "payphone.failed": "❌ The payment was declined or could not be completed.",
    "payphone.pending": "⏳ Your payment is pending confirmation in PayPhone.",
    "payphone.error": "⚠️ An error occurred while processing the payment.",
  };
  return (lang === "en" ? EN : ES)[PAYPHONE_MSG_KEYS[key]] || ES[PAYPHONE_MSG_KEYS[key]];
}

export async function payphoneProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const token = process.env.PAYPHONE_TOKEN;
  const storeId = process.env.PAYPHONE_STORE_ID;
  const countryCode = input.countryCode || "593";

  // Common extras
  const extras = {
    payphone_business_status: "configured" as string,
    payphone_store_id: storeId ?? null,
    payphone_personal_status: "skipped" as string,
    customer_phone: input.phoneNumber,
    customer_document: input.customerDocument,
    customer_name: input.customer,
    country_code: countryCode,
  };

  // Not configured → fall back to Mock behavior but keep provider label.
  if (!token || !storeId) {
    const outcome: PaymentStatus = (() => {
      const r = Math.random();
      if (r < 0.65) return "payment_success";
      if (r < 0.8) return "payment_failed";
      if (r < 0.93) return "payment_pending";
      return "error";
    })();
    return buildResult({
      payment_id: `pp_fallback_${Date.now()}`,
      provider: "PayPhone",
      provider_payment_id: null,
      payment_status: outcome,
      payment_link: "",
      input,
      base,
      whatsapp_message:
        outcome === "payment_success"
          ? msg("success", lang)
          : outcome === "payment_failed"
          ? msg("failed", lang)
          : outcome === "payment_pending"
          ? msg("pending", lang)
          : msg("error", lang),
      extras: {
        ...extras,
        payphone_business_status: "not_configured",
      },
      raw_response: {
        provider: "PayPhone",
        credentials_configured: false,
        note: "PAYPHONE_TOKEN/PAYPHONE_STORE_ID no configurados.",
        fallback_to_mock: true,
        outcome,
      },
    });
  }

  // API Users Check — verify the customer is registered in PayPhone.
  if (input.phoneNumber) {
    const check = await safeFetch(
      `https://pay.payphonelab.com/api/v1/users/check/${countryCode}${input.phoneNumber}`,
      { method: "GET", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!check.ok) {
      return buildResult({
        payment_id: `pp_nouser_${Date.now()}`,
        provider: "PayPhone",
        provider_payment_id: null,
        payment_status: "payment_failed",
        payment_link: "",
        input,
        base,
        whatsapp_message: msg("customer_not_registered", lang),
        extras: {
          ...extras,
          payphone_personal_status: "not_registered",
        },
        raw_response: {
          provider: "PayPhone",
          step: "users_check",
          registered: false,
          httpStatus: check.status,
        },
      });
    }
  }

  // API Sale — recommended flow (no payment_link generated).
  try {
    const amountCents = Math.round(input.amount * 100);
    const saleBody: Record<string, unknown> = {
      phoneNumber: input.phoneNumber,
      countryCode,
      amount: amountCents,
      amountWithoutTax: amountCents,
      currency: input.currency,
      clientTransactionId: base.order_id,
      storeId,
      reference: input.reference || input.description,
    };

    const sale = await safeFetch("https://pay.payphonelab.com/api/v1/sale", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(saleBody),
    });

    const data = sale.data || {};
    const status = normalizeStatus(
      (data as { status?: unknown }).status ?? (sale.ok ? "payment_pending" : "error")
    );

    let waMsg = msg("error", lang);
    if (status === "payment_success") waMsg = msg("success", lang);
    else if (status === "payment_failed") waMsg = msg("failed", lang);
    else if (status === "payment_pending") waMsg = whatsappMessageForPayphoneSale(lang);

    return buildResult({
      payment_id: String((data as { paymentId?: unknown }).paymentId ?? `pp_${Date.now()}`),
      provider: "PayPhone",
      provider_payment_id: String((data as { paymentId?: unknown }).paymentId ?? null) || null,
      payment_status: status,
      payment_link: "", // API Sale never returns a link
      input,
      base,
      whatsapp_message: waMsg,
      extras: {
        ...extras,
        payphone_personal_status: "registered",
      },
      raw_response: {
        provider: "PayPhone",
        step: "sale",
        httpStatus: sale.status,
        ...(data as object),
      },
    });
  } catch (err) {
    return buildResult({
      payment_id: `pp_err_${Date.now()}`,
      provider: "PayPhone",
      provider_payment_id: null,
      payment_status: "error",
      payment_link: "",
      input,
      base,
      whatsapp_message: msg("error", lang),
      extras,
      raw_response: {
        provider: "PayPhone",
        step: "sale",
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

export { whatsappMessageForStatus };
