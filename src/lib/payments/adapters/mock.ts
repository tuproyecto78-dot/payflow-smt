// Mock adapter — simulated payments for testing.
// Allows forcing a specific outcome via input.forceOutcome.

import {
  type CreatePaymentInput,
  type NormalizedPaymentResult,
  type PaymentStatus,
} from "../types";
import {
  type AdapterBase,
  buildResult,
  whatsappMessageForStatus,
} from "./_shared";

export function mockProvider(
  input: CreatePaymentInput,
  base: AdapterBase
): NormalizedPaymentResult {
  const lang = input.language || "es";
  const forced = input.forceOutcome;
  const outcome: PaymentStatus = forced
    ? forced
    : (() => {
        const r = Math.random();
        if (r < 0.65) return "payment_success";
        if (r < 0.8) return "payment_failed";
        if (r < 0.93) return "payment_pending";
        return "error";
      })();

  const mockId = `mock_${Date.now()}`;
  const link =
    outcome === "error" ? "" : `https://pay.payflow.smt/mock/${base.order_id}`;

  return buildResult({
    payment_id: mockId,
    provider: "Mock",
    provider_payment_id: mockId,
    payment_status: outcome,
    payment_link: link,
    input,
    base,
    whatsapp_message: whatsappMessageForStatus(outcome, lang),
    raw_response: {
      provider: "Mock",
      outcome,
      simulated: true,
      forced: Boolean(forced),
    },
  });
}
