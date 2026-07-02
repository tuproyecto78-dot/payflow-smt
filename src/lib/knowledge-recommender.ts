/**
 * PayFlow SMT — Knowledge-based Workflow Template Recommender
 *
 * After processing knowledge (from files or manual text), this function
 * analyzes the detected data and recommends the best workflow template.
 *
 * Rules:
 *   1. products + prices                     → IA + Catálogo
 *   2. products + prices + payment_required  → IA + Catálogo + PayPhone
 *   3. services + horarios                   → IA + Agenda
 *   4. services + horarios + cobro reserva   → IA + Agenda + PayPhone
 *   5. only FAQs/políticas/descripción       → Solo IA sin pagos
 *   6. products + services + agenda + pagos  → Agente comercial completo
 */

export interface DetectedKnowledgeForRecommend {
  products?: Array<{ name: string; price?: number; stock?: number }>;
  services?: Array<{ name: string; price?: number; durationMinutes?: number }>;
  business_hours?: Array<{ day: string; open: string; close: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  policies?: string[];
  prices?: Array<{ item: string; price: number }>;
  stock_items?: Array<{ name: string; stock: number }>;
  address?: string;
  payment_conditions?: string[];
  appointment_conditions?: string[];
}

export type RecommendedTemplate =
  | "solo_ia"
  | "ia_catalogo"
  | "ia_agenda"
  | "ia_payphone"
  | "ia_agenda_payphone"
  | "agente_completo";

export interface RecommendationResult {
  recommended_template: RecommendedTemplate;
  reason: string;
  detected_modules: string[];
  missing_data: string[];
  confidence_score: number;
}

export function recommendWorkflowTemplateFromKnowledge(
  detected: DetectedKnowledgeForRecommend,
  options?: { paymentRequired?: boolean; reservationPayment?: boolean }
): RecommendationResult {
  const products = detected.products || [];
  const services = detected.services || [];
  const hours = detected.business_hours || [];
  const faqs = detected.faqs || [];
  const policies = detected.policies || [];
  const prices = detected.prices || [];
  const stock = detected.stock_items || [];
  const address = detected.address || "";
  const paymentConditions = detected.payment_conditions || [];
  const appointmentConditions = detected.appointment_conditions || [];

  const hasProducts = products.length > 0;
  const hasPrices =
    prices.length > 0 || products.some((p) => p.price !== undefined && p.price > 0);
  const hasStock = stock.length > 0 || products.some((p) => p.stock !== undefined);
  const hasServices = services.length > 0;
  const hasHours = hours.length > 0;
  const hasFaqs = faqs.length > 0;
  const hasPolicies = policies.length > 0;
  const hasAddress = !!address;
  const hasPaymentConditions = paymentConditions.length > 0;
  const hasAppointmentConditions = appointmentConditions.length > 0;

  const paymentRequired = options?.paymentRequired ?? false;
  const reservationPayment = options?.reservationPayment ?? false;

  const detected_modules: string[] = [];
  const missing_data: string[] = [];

  if (hasProducts) detected_modules.push("Catálogo");
  if (hasServices) detected_modules.push("Agenda");
  if (hasHours) detected_modules.push("Horarios");
  if (hasFaqs) detected_modules.push("FAQs");
  if (hasPolicies) detected_modules.push("Políticas");
  if (hasPrices) detected_modules.push("Precios");
  if (hasStock) detected_modules.push("Stock");
  if (hasAddress) detected_modules.push("Dirección");

  // Determine missing data
  if (!hasProducts && !hasServices) missing_data.push("Productos o servicios");
  if (hasProducts && !hasPrices) missing_data.push("Precios de productos");
  if (hasProducts && !hasStock) missing_data.push("Stock de productos");
  if (hasServices && !hasHours) missing_data.push("Horarios de atención");
  if (!hasFaqs) missing_data.push("Preguntas frecuentes");
  if (!hasPolicies) missing_data.push("Políticas del negocio");

  // ─── Rule 6: Agente comercial completo ────────────────────────────
  // products + services + agenda + pagos
  if (hasProducts && hasServices && hasHours && (paymentRequired || hasPaymentConditions)) {
    return {
      recommended_template: "agente_completo",
      reason:
        "Detectamos productos, servicios, horarios y condiciones de pago. Recomendamos el Agente comercial completo para vender, agendar y cobrar automáticamente.",
      detected_modules,
      missing_data,
      confidence_score: 0.95,
    };
  }

  // ─── Rule 2: IA + Catálogo + PayPhone ─────────────────────────────
  // products + prices + payment_required
  if (hasProducts && hasPrices && paymentRequired) {
    return {
      recommended_template: "ia_catalogo",
      reason:
        "Detectamos productos con precios y pagos activos. Recomendamos IA + Catálogo con PayPhone para vender y cobrar automáticamente.",
      detected_modules,
      missing_data,
      confidence_score: 0.9,
    };
  }

  // ─── Rule 4: IA + Agenda + PayPhone ───────────────────────────────
  // services + horarios + cobro de reserva
  if (hasServices && hasHours && (reservationPayment || hasAppointmentConditions)) {
    return {
      recommended_template: "ia_agenda_payphone",
      reason:
        "Detectamos servicios, horarios y condiciones de reserva. Recomendamos IA + Agenda + PayPhone para agendar y cobrar anticipos.",
      detected_modules,
      missing_data,
      confidence_score: 0.88,
    };
  }

  // ─── Rule 1: IA + Catálogo ────────────────────────────────────────
  // products + prices (sin pago)
  if (hasProducts && hasPrices) {
    return {
      recommended_template: "ia_catalogo",
      reason:
        "Detectamos productos con precios. Recomendamos IA + Catálogo para mostrar productos y responder consultas.",
      detected_modules,
      missing_data,
      confidence_score: 0.85,
    };
  }

  // ─── Rule 3: IA + Agenda ──────────────────────────────────────────
  // services + horarios (sin pago)
  if (hasServices && hasHours) {
    return {
      recommended_template: "ia_agenda",
      reason:
        "Detectamos servicios y horarios. Recomendamos IA + Agenda para agendar citas automáticamente.",
      detected_modules,
      missing_data,
      confidence_score: 0.85,
    };
  }

  // ─── Rule 5: Solo IA sin pagos ────────────────────────────────────
  // only FAQs/políticas/descripción
  if (hasFaqs || hasPolicies || hasAddress) {
    return {
      recommended_template: "solo_ia",
      reason:
        "Detectamos información general, FAQs y políticas. Recomendamos Solo IA sin pagos para atender consultas con información del negocio.",
      detected_modules,
      missing_data,
      confidence_score: 0.7,
    };
  }

  // ─── Fallback: Solo IA ────────────────────────────────────────────
  return {
    recommended_template: "solo_ia",
    reason:
      "No detectamos datos suficientes para recomendar un flujo específico. Recomendamos empezar con Solo IA y agregar módulos después.",
    detected_modules,
    missing_data: ["Productos", "Servicios", "Horarios", "FAQs", "Precios"],
    confidence_score: 0.3,
  };
}

// ─── Template metadata for UI ────────────────────────────────────────

export const TEMPLATE_INFO: Record<
  RecommendedTemplate,
  { name: string; description: string; modules: string[] }
> = {
  solo_ia: {
    name: "Solo IA (sin pagos)",
    description: "WhatsApp + IA + respuesta + humano. Sin PayPhone.",
    modules: ["IA"],
  },
  ia_catalogo: {
    name: "IA + Catálogo",
    description: "WhatsApp + IA + búsqueda de productos.",
    modules: ["IA", "Catálogo"],
  },
  ia_agenda: {
    name: "IA + Agenda",
    description: "WhatsApp + IA + agenda de citas.",
    modules: ["IA", "Agenda"],
  },
  ia_payphone: {
    name: "IA + PayPhone",
    description: "WhatsApp + IA + cobro con PayPhone API Link.",
    modules: ["IA", "PayPhone"],
  },
  ia_agenda_payphone: {
    name: "IA + Agenda + PayPhone",
    description: "Agenda + cobro de anticipo con PayPhone.",
    modules: ["IA", "Agenda", "PayPhone"],
  },
  agente_completo: {
    name: "Agente comercial completo",
    description: "Vende, cobra, agenda y deriva a humano.",
    modules: ["IA", "Catálogo", "Agenda", "PayPhone"],
  },
};
