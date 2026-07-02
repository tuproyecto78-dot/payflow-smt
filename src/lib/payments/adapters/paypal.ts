// PayPal adapter — Orders API v2 via backend.
// Creates an order and returns approval_url as payment_link; initial status payment_pending.
// Webhook should listen for CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED.

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

const PAYPAL_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  production: "https://api-m.paypal.com",
};

async function getPaypalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const env = process.env.PAYPAL_ENV === "production" ? "production" : "sandbox";
  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const result = await safeFetch(`${PAYPAL_BASE[env]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!result.ok || !result.data) return null;
  return String((result.data as { access_token?: unknown }).access_token ?? "") || null;
}

export async function paypalProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const env = process.env.PAYPAL_ENV === "production" ? "production" : "sandbox";

  // Not configured → simulated link
  if (!clientId || !clientSecret) {
    const link = `https://pay.payflow.smt/paypal/${base.order_id}`;
    return buildResult({
      payment_id: `paypal_sim_${Date.now()}`,
      provider: "PayPal",
      provider_payment_id: null,
      payment_status: "payment_pending",
      payment_link: link,
      input,
      base,
      whatsapp_message: whatsappMessageForLink("PayPal", lang),
      raw_response: {
        provider: "PayPal",
        credentials_configured: false,
        simulated: true,
        env,
      },
    });
  }

  const accessToken = await getPaypalAccessToken();
  if (!accessToken) {
    return buildResult({
      payment_id: `paypal_autherr_${Date.now()}`,
      provider: "PayPal",
      provider_payment_id: null,
      payment_status: "error",
      payment_link: "",
      input,
      base,
      whatsapp_message: whatsappMessageForStatus("error", lang),
      raw_response: { provider: "PayPal", step: "auth", error: "Failed to obtain access token" },
    });
  }

  // Create order with intent=CAPTURE
  const orderBody = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: base.order_id,
        description: input.description,
        amount: {
          currency_code: input.currency,
          value: input.amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "PayFlow SMT",
      return_url: `https://payflow.smt/pay/success?order=${base.order_id}`,
      cancel_url: `https://payflow.smt/pay/cancel?order=${base.order_id}`,
      user_action: "PAY_NOW",
    },
  };

  const result = await safeFetch(`${PAYPAL_BASE[env]}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderBody),
  });

  const data = result.data || {};
  const providerPaymentId = String((data as { id?: unknown }).id ?? null) || null;
  // Extract approval_url from links
  const links = (data as { links?: Array<{ rel: string; href: string }> }).links || [];
  const approvalLink = links.find((l) => l.rel === "approve")?.href || "";
  const status = normalizeStatus(
    (data as { status?: unknown }).status ?? (result.ok ? "payment_pending" : "error")
  );

  return buildResult({
    payment_id: providerPaymentId || `paypal_${Date.now()}`,
    provider: "PayPal",
    provider_payment_id: providerPaymentId,
    payment_status: status,
    payment_link: approvalLink,
    input,
    base,
    whatsapp_message:
      status === "payment_pending" && approvalLink
        ? whatsappMessageForLink("PayPal", lang)
        : whatsappMessageForStatus(status, lang),
    raw_response: {
      provider: "PayPal",
      env,
      httpStatus: result.status,
      ...(data as object),
    },
  });
}
