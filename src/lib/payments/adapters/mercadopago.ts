// Mercado Pago adapter — Checkout Pro / Preferences via backend.
// Creates a preference and returns init_point as payment_link; initial status payment_pending.
// Webhook should listen for payment notifications and merchant_order updates.

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

const MP_BASE = {
  sandbox: "https://api.mercadopago.com",
  production: "https://api.mercadopago.com",
};

export async function mercadoPagoProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  // Access tokens starting with TEST- are sandbox; APP_USR- are production.
  const env = accessToken?.startsWith("APP_USR") ? "production" : "sandbox";

  // Not configured → simulated link
  if (!accessToken) {
    const link = `https://pay.payflow.smt/mp/${base.order_id}`;
    return buildResult({
      payment_id: `mp_sim_${Date.now()}`,
      provider: "Mercado Pago",
      provider_payment_id: null,
      payment_status: "payment_pending",
      payment_link: link,
      input,
      base,
      whatsapp_message: whatsappMessageForLink("Mercado Pago", lang),
      raw_response: {
        provider: "Mercado Pago",
        credentials_configured: false,
        simulated: true,
        env: "sandbox",
      },
    });
  }

  // Create preference
  const prefBody = {
    items: [
      {
        id: base.order_id,
        title: input.description || "Pago",
        quantity: 1,
        unit_price: input.amount,
        currency_id: input.currency,
      },
    ],
    external_reference: base.order_id,
    back_urls: {
      success: `https://payflow.smt/pay/success?order=${base.order_id}`,
      pending: `https://payflow.smt/pay/pending?order=${base.order_id}`,
      failure: `https://payflow.smt/pay/cancel?order=${base.order_id}`,
    },
    auto_return: "approved",
    // sandbox init_point is returned when access token is TEST-*
  };

  const result = await safeFetch(`${MP_BASE[env]}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefBody),
  });

  const data = result.data || {};
  // init_point = production checkout URL; sandbox_init_point = sandbox URL
  const initPoint =
    env === "production"
      ? String((data as { init_point?: unknown }).init_point ?? "")
      : String(
          (data as { sandbox_init_point?: unknown }).sandbox_init_point ??
            (data as { init_point?: unknown }).init_point ??
            ""
        );
  const providerPaymentId = String((data as { id?: unknown }).id ?? null) || null;
  const status = normalizeStatus(
    result.ok ? "payment_pending" : "error"
  );

  return buildResult({
    payment_id: providerPaymentId || `mp_${Date.now()}`,
    provider: "Mercado Pago",
    provider_payment_id: providerPaymentId,
    payment_status: status,
    payment_link: initPoint,
    input,
    base,
    whatsapp_message:
      status === "payment_pending" && initPoint
        ? whatsappMessageForLink("Mercado Pago", lang)
        : whatsappMessageForStatus(status, lang),
    raw_response: {
      provider: "Mercado Pago",
      env,
      httpStatus: result.status,
      ...(data as object),
    },
  });
}
