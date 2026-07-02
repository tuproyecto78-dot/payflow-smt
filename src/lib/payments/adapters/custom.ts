// Custom API adapter — calls an external endpoint configured per-node.
// endpoint_url, method, headers, body_template, status_mapping are configured
// on the node; secret headers (CUSTOM_PAYMENT_API_KEY) are injected server-side
// and never exposed to the frontend.

import {
  type CreatePaymentInput,
  type NormalizedPaymentResult,
  type PaymentStatus,
} from "../types";
import {
  type AdapterBase,
  buildResult,
  safeFetch,
  whatsappMessageForLink,
  whatsappMessageForStatus,
} from "./_shared";

export async function customApiProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): Promise<NormalizedPaymentResult> {
  const lang = input.language || "es";
  const url = input.customApiUrl;
  const apiKey = process.env.CUSTOM_PAYMENT_API_KEY;

  if (!url) {
    return buildResult({
      payment_id: `api_err_${Date.now()}`,
      provider: "API personalizada",
      provider_payment_id: null,
      payment_status: "error",
      payment_link: "",
      input,
      base,
      whatsapp_message: whatsappMessageForStatus("error", lang),
      raw_response: {
        provider: "API personalizada",
        error: "No se configuró customApiUrl",
      },
    });
  }

  // Build body from template or default shape
  let bodyStr: string;
  if (input.customApiBodyTemplate) {
    bodyStr = input.customApiBodyTemplate
      .replace(/\{\{amount\}\}/g, String(input.amount))
      .replace(/\{\{currency\}\}/g, input.currency)
      .replace(/\{\{description\}\}/g, input.description)
      .replace(/\{\{customer\}\}/g, input.customer)
      .replace(/\{\{phone_number\}\}/g, input.phoneNumber)
      .replace(/\{\{order_id\}\}/g, base.order_id);
  } else {
    bodyStr = JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customer: input.customer,
      phoneNumber: input.phoneNumber,
      orderId: base.order_id,
    });
  }

  // Merge secret headers (server-side only) with node-configured headers.
  // The CUSTOM_PAYMENT_API_KEY is injected as "X-API-Key" if present.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(input.customApiHeaders || {}),
  };
  if (apiKey && !headers["X-API-Key"] && !headers["x-api-key"] && !headers["Authorization"]) {
    headers["X-API-Key"] = apiKey;
  }

  const result = await safeFetch(url, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  const data = result.data || {};
  // Normalize using the node's status_mapping if provided, else use defaults.
  const mapping = input.customApiStatusMapping || {};
  const rawStatus =
    (data as { status?: unknown }).status ??
    (data as { payment_status?: unknown }).payment_status ??
    (result.ok ? "payment_pending" : "error");

  let status: PaymentStatus;
  if (typeof rawStatus === "string" && mapping[rawStatus]) {
    status = mapping[rawStatus];
  } else {
    status = normalizeStatusLocal(rawStatus);
  }

  const paymentLink = String(
    (data as { payment_link?: unknown }).payment_link ??
      (data as { link?: unknown }).link ??
      (data as { checkout_url?: unknown }).checkout_url ??
      ""
  );
  const providerPaymentId = String(
    (data as { provider_payment_id?: unknown }).provider_payment_id ??
      (data as { payment_id?: unknown }).payment_id ??
      (data as { id?: unknown }).id ??
      null
  ) || null;

  return buildResult({
    payment_id: providerPaymentId || `api_${Date.now()}`,
    provider: "API personalizada",
    provider_payment_id: providerPaymentId,
    payment_status: status,
    payment_link: paymentLink,
    input,
    base,
    whatsapp_message:
      status === "payment_pending" && paymentLink
        ? whatsappMessageForLink("API personalizada", lang)
        : whatsappMessageForStatus(status, lang),
    raw_response: {
      provider: "API personalizada",
      httpStatus: result.status,
      ...(data as object),
    },
  });
}

function normalizeStatusLocal(raw: unknown): PaymentStatus {
  if (typeof raw !== "string") return "payment_pending";
  const s = raw.toLowerCase();
  if (["payment_success", "succeeded", "approved", "paid", "completed", "success"].includes(s))
    return "payment_success";
  if (["payment_failed", "failed", "declined", "rejected", "canceled", "cancelled"].includes(s))
    return "payment_failed";
  if (s === "error") return "error";
  return "payment_pending";
}
