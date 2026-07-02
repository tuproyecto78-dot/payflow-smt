// DEUNA adapter — Payment Link via backend.
// Generates payment_link; initial status payment_pending.

import {
  type CreatePaymentInput,
  type NormalizedPaymentResult,
} from "../types";
import {
  type AdapterBase,
  buildResult,
  normalizeStatus,
  safeFetch,
  whatsappMessageForLink,
  whatsappMessageForStatus,
} from "./_shared";

const DEUNA_BASE = {
  sandbox: "https://api.sandbox.deuna.io",
  production: "https://api.deuna.io",
};

export async function deunaProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const apiKey = process.env.DEUNA_API_KEY;
  const merchantId = process.env.DEUNA_MERCHANT_ID;
  const env = process.env.DEUNA_ENV === "production" ? "production" : "sandbox";

  // Not configured → simulated link
  if (!apiKey || !merchantId) {
    const link = `https://pay.payflow.smt/deuna/${base.order_id}`;
    return buildResult({
      payment_id: `deuna_sim_${Date.now()}`,
      provider: "DEUNA",
      provider_payment_id: null,
      payment_status: "payment_pending",
      payment_link: link,
      input,
      base,
      whatsapp_message: whatsappMessageForLink("DEUNA", lang),
      raw_response: {
        provider: "DEUNA",
        credentials_configured: false,
        simulated: true,
        env,
      },
    });
  }

  const url = `${DEUNA_BASE[env]}/v1/payment-links`;
  const result = await safeFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Merchant-Id": merchantId,
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      reference: base.order_id,
      description: input.description,
    }),
  });

  const data = result.data || {};
  const status = normalizeStatus(
    (data as { status?: unknown }).status ?? (result.ok ? "payment_pending" : "error")
  );
  const paymentLink = String((data as { paymentLink?: unknown }).paymentLink ?? "");
  const providerPaymentId = String((data as { id?: unknown }).id ?? null) || null;

  return buildResult({
    payment_id: providerPaymentId || `deuna_${Date.now()}`,
    provider: "DEUNA",
    provider_payment_id: providerPaymentId,
    payment_status: status,
    payment_link: paymentLink,
    input,
    base,
    whatsapp_message:
      status === "payment_pending" && paymentLink
        ? whatsappMessageForLink("DEUNA", lang)
        : whatsappMessageForStatus(status, lang),
    raw_response: {
      provider: "DEUNA",
      env,
      httpStatus: result.status,
      ...(data as object),
    },
  });
}
