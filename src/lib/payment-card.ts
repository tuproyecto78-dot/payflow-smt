// Payment card generator for PayFlow SMT.
// Generates a visual receipt-style card that can be sent via WhatsApp.
// The card is a text summary (not a credit card form) — the actual payment
// is processed by PayPhone API Sale or the configured provider.

export interface PaymentCardData {
  business_name: string;
  amount: number;
  currency: string;
  order_id: string;
  status: string;
  provider: string;
  customer_name?: string;
  customer_phone?: string;
  description?: string;
  language?: "es" | "en";
}

export interface PaymentCardResult {
  text: string;
  // A compact single-line summary for toast notifications.
  summary: string;
  // The payment status label in the chosen language.
  statusLabel: string;
}

const STATUS_LABELS_ES: Record<string, string> = {
  payment_success: "Confirmado",
  payment_failed: "Rechazado",
  payment_pending: "Pendiente",
  error: "Error",
};

const STATUS_LABELS_EN: Record<string, string> = {
  payment_success: "Confirmed",
  payment_failed: "Declined",
  payment_pending: "Pending",
  error: "Error",
};

const STATUS_EMOJI: Record<string, string> = {
  payment_success: "✅",
  payment_failed: "❌",
  payment_pending: "⏳",
  error: "⚠️",
};

export function generatePaymentCard(data: PaymentCardData): PaymentCardResult {
  const lang = data.language || "es";
  const labels = lang === "en" ? STATUS_LABELS_EN : STATUS_LABELS_ES;
  const statusLabel = labels[data.status] || data.status;
  const emoji = STATUS_EMOJI[data.status] || "📋";

  const lines = [
    "━━━━━━━━━━━━━━━━━━━━",
    "  💳 PayFlow SMT",
    "  Solicitud de pago",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    `🏪 Negocio: ${data.business_name || "—"}`,
    `💰 Monto: ${formatAmount(data.amount, data.currency)}`,
    `📦 Pedido: ${data.order_id || "—"}`,
    `${emoji} Estado: ${statusLabel}`,
    `🏦 Proveedor: ${data.provider || "—"}`,
  ];

  if (data.description) {
    lines.push(`📝 Concepto: ${data.description}`);
  }
  if (data.customer_name) {
    lines.push(`👤 Cliente: ${data.customer_name}`);
  }

  lines.push("");
  lines.push(lang === "en" ? "— PayFlow SMT —" : "— PayFlow SMT —");

  const text = lines.join("\n");
  const summary = `${data.business_name || ""} · ${formatAmount(data.amount, data.currency)} · ${statusLabel}`;

  return { text, summary, statusLabel };
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  return `${symbol} ${amount.toFixed(2)}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  MXN: "$",
  COP: "$",
  PEN: "S/",
  CLP: "$",
  ARS: "$",
  BRL: "R$",
};

// Short payment confirmation message for the WhatsApp outcome node.
export function paymentOutcomeMessage(
  status: string,
  provider: string,
  language: "es" | "en" = "es"
): string {
  const isPayPhone = provider === "PayPhone";
  const ES = {
    payment_success: "✅ Tu pago fue confirmado correctamente. Gracias por tu compra.",
    payment_failed: "❌ El pago fue rechazado o no pudo completarse.",
    payment_pending: isPayPhone
      ? "⏳ Tu pago está pendiente de confirmación en PayPhone."
      : "⏳ Tu pago está pendiente de confirmación. Te avisaremos cuando sea aprobado.",
    error: "⚠️ Ocurrió un error procesando el pago. Por favor intenta nuevamente.",
  };
  const EN = {
    payment_success: "✅ Your payment was confirmed successfully. Thank you for your purchase.",
    payment_failed: "❌ The payment was declined or could not be completed.",
    payment_pending: isPayPhone
      ? "⏳ Your payment is pending confirmation in PayPhone."
      : "⏳ Your payment is pending confirmation. We'll let you know when it's approved.",
    error: "⚠️ An error occurred while processing the payment. Please try again.",
  };
  const map = language === "en" ? EN : ES;
  return map[status as keyof typeof map] || map.error;
}
