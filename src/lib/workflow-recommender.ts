/**
 * PayFlow SMT — Workflow Template Recommendation
 *
 * Analyzes detected knowledge and recommends the best workflow template.
 *
 * Recommendation rules:
 *   1. products + prices → IA + Catálogo
 *   2. products + prices + payment_required → IA + Catálogo + PayPhone
 *   3. services + horarios → IA + Agenda
 *   4. services + horarios + cobro de reserva → IA + Agenda + PayPhone
 *   5. solo FAQs + políticas + descripción → Solo IA sin pagos
 *   6. productos + servicios + agenda + pagos → Agente comercial completo
 */

import type { DetectedKnowledge } from "./knowledge-processor";

// ─── Types ───────────────────────────────────────────────────────────

export type RecommendedTemplateId =
  | "solo_ia"
  | "ia_catalogo"
  | "ia_catalogo_payphone"
  | "ia_agenda"
  | "ia_agenda_payphone"
  | "ia_payphone"
  | "agente_completo";

export interface RecommendationResult {
  recommended_template: RecommendedTemplateId;
  template_name: string;
  reason: string;
  detected_modules: string[];
  missing_data: string[];
  confidence_score: number;
  // Pre-configured form values based on detection
  suggested_config: {
    uses_catalog: boolean;
    uses_agenda: boolean;
    payment_required: boolean;
    payment_provider: "none" | "payphone" | "mock";
    agent_mode: "vender" | "cobrar" | "agendar" | "completo";
  };
}

// ─── Template metadata ───────────────────────────────────────────────

const TEMPLATE_NAMES: Record<RecommendedTemplateId, string> = {
  solo_ia: "Solo IA (sin pagos)",
  ia_catalogo: "IA + Catálogo",
  ia_catalogo_payphone: "IA + Catálogo + PayPhone",
  ia_agenda: "IA + Agenda",
  ia_agenda_payphone: "IA + Agenda + PayPhone",
  ia_payphone: "IA + PayPhone",
  agente_completo: "Agente comercial completo",
};

// ─── Main recommendation function ────────────────────────────────────

export function recommendWorkflowTemplateFromKnowledge(
  detected: DetectedKnowledge,
  options?: { paymentRequired?: boolean }
): RecommendationResult {
  const hasProducts = detected.products.length > 0;
  const hasPrices = detected.prices.length > 0 || detected.products.some((p) => p.price !== undefined);
  const hasStock = detected.stock_items.length > 0 || detected.products.some((p) => p.stock !== undefined);
  const hasServices = detected.services.length > 0;
  const hasHours = detected.business_hours.length > 0;
  const hasFaqs = detected.faqs.length > 0;
  const hasPolicies = detected.policies.length > 0;
  const hasBusinessInfo = !!detected.address || hasFaqs || hasPolicies;
  const paymentRequired = options?.paymentRequired ?? false;

  const detected_modules: string[] = [];
  const missing_data: string[] = [];

  if (hasProducts) detected_modules.push("productos");
  if (hasPrices) detected_modules.push("precios");
  if (hasStock) detected_modules.push("stock");
  if (hasServices) detected_modules.push("servicios");
  if (hasHours) detected_modules.push("horarios");
  if (hasFaqs) detected_modules.push("FAQs");
  if (hasPolicies) detected_modules.push("políticas");
  if (detected.address) detected_modules.push("dirección");

  // ─── Rule 6: products + services + agenda + pagos → Agente completo ──
  if (hasProducts && hasPrices && hasServices && hasHours) {
    const reason = paymentRequired
      ? "Detectamos productos con precios, servicios, horarios y pagos activos. Recomendamos el Agente comercial completo."
      : "Detectamos productos, servicios y horarios. Recomendamos el Agente comercial completo para vender, agendar y cobrar.";
    return {
      recommended_template: "agente_completo",
      template_name: TEMPLATE_NAMES.agente_completo,
      reason,
      detected_modules,
      missing_data: [],
      confidence_score: 0.95,
      suggested_config: {
        uses_catalog: true,
        uses_agenda: true,
        payment_required: paymentRequired,
        payment_provider: paymentRequired ? "payphone" : "none",
        agent_mode: "completo",
      },
    };
  }

  // ─── Rule 2: products + prices + payment → IA + Catálogo + PayPhone ──
  if (hasProducts && hasPrices && paymentRequired) {
    return {
      recommended_template: "ia_catalogo_payphone",
      template_name: TEMPLATE_NAMES.ia_catalogo_payphone,
      reason:
        "Detectamos productos con precios y pagos activos. Recomendamos IA + Catálogo + PayPhone para vender y cobrar.",
      detected_modules,
      missing_data: missingForCatalog(hasStock, hasHours),
      confidence_score: 0.9,
      suggested_config: {
        uses_catalog: true,
        uses_agenda: false,
        payment_required: true,
        payment_provider: "payphone",
        agent_mode: "vender",
      },
    };
  }

  // ─── Rule 1: products + prices → IA + Catálogo ──────────────────────
  if (hasProducts && hasPrices) {
    return {
      recommended_template: "ia_catalogo",
      template_name: TEMPLATE_NAMES.ia_catalogo,
      reason:
        "Detectamos productos y precios. Recomendamos IA + Catálogo para mostrar productos al cliente.",
      detected_modules,
      missing_data: missingForCatalog(hasStock, hasHours),
      confidence_score: 0.85,
      suggested_config: {
        uses_catalog: true,
        uses_agenda: false,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "vender",
      },
    };
  }

  // ─── Rule 4: services + horarios + cobro → IA + Agenda + PayPhone ────
  if (hasServices && hasHours && paymentRequired) {
    return {
      recommended_template: "ia_agenda_payphone",
      template_name: TEMPLATE_NAMES.ia_agenda_payphone,
      reason:
        "Detectamos servicios, horarios y cobro de reserva. Recomendamos IA + Agenda + PayPhone para agendar y cobrar anticipo.",
      detected_modules,
      missing_data: missingForAgenda(hasFaqs, hasPolicies),
      confidence_score: 0.88,
      suggested_config: {
        uses_catalog: false,
        uses_agenda: true,
        payment_required: true,
        payment_provider: "payphone",
        agent_mode: "agendar",
      },
    };
  }

  // ─── Rule 3: services + horarios → IA + Agenda ──────────────────────
  if (hasServices && hasHours) {
    return {
      recommended_template: "ia_agenda",
      template_name: TEMPLATE_NAMES.ia_agenda,
      reason:
        "Detectamos servicios y horarios. Recomendamos IA + Agenda para agendar citas automáticamente.",
      detected_modules,
      missing_data: missingForAgenda(hasFaqs, hasPolicies),
      confidence_score: 0.82,
      suggested_config: {
        uses_catalog: false,
        uses_agenda: true,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "agendar",
      },
    };
  }

  // ─── Rule 5: solo FAQs/políticas/descripción → Solo IA ──────────────
  if (hasFaqs || hasPolicies || hasBusinessInfo) {
    const parts: string[] = [];
    if (hasFaqs) parts.push("FAQs");
    if (hasPolicies) parts.push("políticas");
    if (detected.address) parts.push("dirección");
    return {
      recommended_template: "solo_ia",
      template_name: TEMPLATE_NAMES.solo_ia,
      reason: `Detectamos ${parts.join(", ")}. Recomendamos Solo IA para responder consultas sin pagos.`,
      detected_modules,
      missing_data: missingForSoloIa(hasProducts, hasServices, hasHours),
      confidence_score: 0.75,
      suggested_config: {
        uses_catalog: false,
        uses_agenda: false,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "completo",
      },
    };
  }

  // ─── Fallback: Solo IA ──────────────────────────────────────────────
  return {
    recommended_template: "solo_ia",
    template_name: TEMPLATE_NAMES.solo_ia,
    reason:
      "No se detectaron productos, servicios ni horarios específicos. Recomendamos empezar con Solo IA.",
    detected_modules,
    missing_data: ["productos", "servicios", "horarios", "precios"],
    confidence_score: 0.4,
    suggested_config: {
      uses_catalog: false,
      uses_agenda: false,
      payment_required: false,
      payment_provider: "none",
      agent_mode: "completo",
    },
  };
}

// ─── Missing data helpers ────────────────────────────────────────────

function missingForCatalog(hasStock: boolean, hasHours: boolean): string[] {
  const missing: string[] = [];
  if (!hasStock) missing.push("stock de productos");
  if (!hasHours) missing.push("horarios de atención");
  return missing;
}

function missingForAgenda(hasFaqs: boolean, hasPolicies: boolean): string[] {
  const missing: string[] = [];
  if (!hasFaqs) missing.push("preguntas frecuentes");
  if (!hasPolicies) missing.push("políticas de cancelación");
  return missing;
}

function missingForSoloIa(
  hasProducts: boolean,
  hasServices: boolean,
  hasHours: boolean
): string[] {
  const missing: string[] = [];
  if (!hasProducts) missing.push("productos (para activar catálogo)");
  if (!hasServices) missing.push("servicios (para activar agenda)");
  if (!hasHours) missing.push("horarios (para activar agenda)");
  return missing;
}
