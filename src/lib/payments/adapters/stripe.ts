// Stripe adapter — Checkout Session via backend.
// Generates payment_link (URL to Checkout); initial status payment_pending.
// Webhook should listen for checkout.session.completed and payment_intent.payment_failed.

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

export async function stripeProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Not configured → simulated link
  if (!secretKey) {
    const link = `https://pay.payflow.smt/stripe/${base.order_id}`;
    return buildResult({
      payment_id: `stripe_sim_${Date.now()}`,
      provider: "Stripe",
      provider_payment_id: null,
      payment_status: "payment_pending",
      payment_link: link,
      input,
      base,
      whatsapp_message: whatsappMessageForLink("Stripe", lang),
      raw_response: {
        provider: "Stripe",
        credentials_configured: false,
        simulated: true,
      },
    });
  }

  // Checkout Session — uses x-www-form-urlencoded body
  const amountMinor = Math.round(input.amount * 100);
  const params = new URLSearchParams({
    amount: String(amountMinor),
    currency: (input.currency || "USD").toLowerCase(),
    "payment_method_types[0]": "card",
    mode: "payment",
    success_url: `https://payflow.smt/pay/success?order=${base.order_id}`,
    cancel_url: `https://payflow.smt/pay/cancel?order=${base.order_id}`,
    client_reference_id: base.order_id,
  });
  if (input.description) params.set("description", input.description);
  if (input.customer) params.set("customer_email", input.customer);

  const result = await safeFetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = result.data || {};
  const status = normalizeStatus(
    (data as { status?: unknown }).status ??
      (data as { payment_status?: unknown }).payment_status ??
      (result.ok ? "payment_pending" : "error")
  );
  const paymentLink = String(
    (data as { url?: unknown }).url ??
      (data as { next_action?: { redirect_to_url?: { url?: string } } }).next_action?.redirect_to_url?.url ??
      ""
  );
  const providerPaymentId = String((data as { id?: unknown }).id ?? null) || null;

  return buildResult({
    payment_id: providerPaymentId || `stripe_${Date.now()}`,
    provider: "Stripe",
    provider_payment_id: providerPaymentId,
    payment_status: status,
    payment_link: paymentLink,
    input,
    base,
    whatsapp_message:
      status === "payment_pending" && paymentLink
        ? whatsappMessageForLink("Stripe", lang)
        : whatsappMessageForStatus(status, lang),
    raw_response: {
      provider: "Stripe",
      httpStatus: result.status,
      ...(data as object),
    },
  });
}
