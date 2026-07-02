// Generador de flujos sugeridos para PayFlow SMT.
// A partir de los datos de una solicitud, genera un workflow visual completo
// con nodos conectados, mensajes personalizados y configuración de pago.
// Multilingüe (es/en) y multimoneda vía src/lib/i18n.

import type { FlowNode, FlowEdge } from "./workflow-types";
import { type Language, t, tf } from "./i18n/strings";
import { detectCountryCodeFromCountry } from "./i18n/currencies";

export type TemplateType =
  | "orders"
  | "appointments"
  | "products"
  | "services"
  | "tuition"
  | "general";

export interface SuggestedWorkflowInput {
  business_name: string;
  phone_number: string;
  business_type: string;
  what_to_charge?: string | null;
  selected_plan: string;
  payment_provider: string;
  country?: string | null;
  city?: string | null;
  has_payphone_business?: boolean;
  has_whatsapp_business?: boolean;
  /** Idioma para los mensajes generados ("es" | "en"). Default: "es". */
  language?: Language;
  /** Código ISO 4217 de la moneda (USD, EUR, MXN, COP, PEN, CLP, ARS, BRL). Default: "USD". */
  currency?: string;
  /** Locale BCP-47 para formato de fechas/montos (es-EC, en-US, ...). Default: "es-EC". */
  locale?: string;
}

export interface SuggestedWorkflowResult {
  name: string;
  templateType: TemplateType;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Moneda usada en el nodo create_payment. */
  currency: string;
  /** Idioma usado para todos los mensajes generados. */
  language: Language;
}

// Selecciona el tipo de plantilla a partir del tipo de negocio y el concepto de cobro.
// NO localiza strings — eso se hace en generateSuggestedWorkflow con i18n.
function selectTemplate(businessType: string, whatToCharge?: string | null): TemplateType {
  const bt = (businessType || "").toLowerCase();
  const wtc = whatToCharge || "";

  // Restaurante / pedidos
  if (bt.includes("restaurante") || bt.includes("comida") || bt.includes("cafeter") || bt.includes("delivery") || wtc === "pedidos") {
    return "orders";
  }

  // Clínica / citas
  if (bt.includes("clínica") || bt.includes("salud") || bt.includes("médico") || bt.includes("odontolog") || bt.includes("estética") || bt.includes("consulta") || bt.includes("cita") || wtc === "citas") {
    return "appointments";
  }

  // Tienda / productos
  if (bt.includes("tienda") || bt.includes("comercio") || bt.includes("boutique") || bt.includes("producto") || bt.includes("catálogo") || bt.includes("retail") || wtc === "productos") {
    return "products";
  }

  // Servicios / facturas
  if (bt.includes("servicio") || bt.includes("técnico") || bt.includes("asesor") || bt.includes("reparación") || bt.includes("factura") || bt.includes("cotización") || wtc === "servicios" || wtc === "facturas") {
    return "services";
  }

  // Educación / cuotas
  if (bt.includes("educación") || bt.includes("academia") || bt.includes("curso") || bt.includes("colegio") || bt.includes("matrícula") || bt.includes("mensualidad") || bt.includes("cuota") || wtc === "cuotas") {
    return "tuition";
  }

  // General
  return "general";
}

function makeId(): string {
  return `sw_${Math.random().toString(36).slice(2, 9)}`;
}

// Modo de pago por defecto para cada proveedor.
// Self-contained: no importa nada de src/lib/payments para mantener este
// archivo independiente del adaptador. Si los modos cambian en el adapter,
// actualizar aquí también.
//   - Mock, PayPhone        → "direct"   (interacción directa en la app del cliente)
//   - DEUNA, API personalizada → "link"     (se genera un enlace de pago)
//   - Stripe, PayPal, Mercado Pago → "checkout" (página de checkout hospedada)
type PaymentMode = "direct" | "link" | "checkout";

function defaultModeForProvider(provider: string): PaymentMode {
  switch (provider) {
    case "Mock":
    case "PayPhone":
      return "direct";
    case "DEUNA":
    case "API personalizada":
      return "link";
    case "Stripe":
    case "PayPal":
    case "Mercado Pago":
      return "checkout";
    default:
      return "direct";
  }
}

// Mensaje de WhatsApp para el nodo resultado "pago pendiente" según el proveedor:
//   - PayPhone                 → "⏳ Tu pago está pendiente de confirmación en PayPhone."
//   - Proveedores link/checkout → "⏳ Tu pago está pendiente de confirmación. Puedes completar el pago aquí: {{payment_link}}"
//   - Mock y cualquier otro    → "⏳ Tu pago está pendiente de confirmación. Te avisaremos cuando sea aprobado."
//
// IMPORTANTE: Este es el mensaje del NODO DE RESULTADO (outcome), no el mensaje
// inicial de creación del pago. El mensaje inicial lo genera cada adaptador en
// su campo `whatsapp_message` (ver src/lib/payments/adapters/).
function pendingMessage(provider: string, lang: Language): string {
  if (provider === "PayPhone") {
    return t("payphone.pending", lang);
  }
  const mode = defaultModeForProvider(provider);
  if (mode === "link" || mode === "checkout") {
    // El placeholder {{payment_link}} se interpola en runtime con la variable
    // payment_link que el motor establece tras ejecutar el nodo Crear pago.
    return t("payment.pending_with_link", lang);
  }
  return t("payment.pending", lang);
}

export function generateSuggestedWorkflow(input: SuggestedWorkflowInput): SuggestedWorkflowResult {
  const lang: Language = input.language || "es";
  const currency: string = input.currency || "USD";
  // locale se mantiene disponible para integraciones futuras (formato de fechas, etc.).
  // const locale = input.locale || "es-EC";

  const templateType = selectTemplate(input.business_type, input.what_to_charge);
  const businessName = input.business_name || "tu negocio";
  const phoneNumber = input.phone_number || "+15551234567";
  const provider = input.payment_provider || "Mock";
  const country = input.country || "Ecuador";
  const countryCode = detectCountryCodeFromCountry(country);

  // ── Strings localizados vía i18n ──────────────────────────────────
  const workflowName = t(`template.${templateType}.name`, lang);
  const welcomeMsg = tf(`template.welcome.${templateType}`, lang, { business_name: businessName });
  const aiLabel = templateType === "general"
    ? t("workflow.ai_label_default", lang)
    : t(`template.ai_label.${templateType}`, lang);
  const aiSystemPrompt = t(`template.ai_prompt.${templateType}`, lang);
  const paymentDescription = t(`template.payment_desc.${templateType}`, lang);

  // El prompt interno del agente usa placeholders que el motor reemplaza en runtime.
  const aiPrompt = `El cliente respondió: {{user_response}}. Extrae los datos necesarios y confirma intención de pago.`;

  // Etiquetas de nodos (i18n)
  const startLabel = t("workflow.start", lang);
  const welcomeLabel = t("workflow.welcome_label", lang);
  const createPaymentLabel = t("workflow.create_payment_label", lang);
  const conditionLabel = t("workflow.condition_success", lang);
  const waSuccessLabel = t("workflow.wa_success_label", lang);
  const waFailedLabel = t("workflow.wa_failed_label", lang);
  const waPendingLabel = t("workflow.wa_pending_label", lang);
  const waErrorLabel = t("workflow.wa_error_label", lang);
  const endLabel = t("workflow.end", lang);
  const endMessage = t("workflow.end_message", lang);

  // Mensajes de resultado (WhatsApp)
  const paymentSuccessMsg = t("payment.success", lang);
  const paymentFailedMsg = t("payment.failed", lang);
  // Mensaje de "pago pendiente" depende del proveedor y su modo (ver pendingMessage()).
  const paymentPendingMsg = pendingMessage(provider, lang);
  const paymentErrorMsg = t("payment.error", lang);

  // Modo de pago por defecto para el proveedor seleccionado (direct | link | checkout).
  const paymentMode: PaymentMode = defaultModeForProvider(provider);

  // Monto placeholder: se mantiene el valor numérico tal cual (49.99) sin importar la moneda.
  // Las monedas de 0 decimales (CLP, COP) no requieren redondeo para un placeholder.
  const amount = 49.99;

  // Posiciones de nodos (layout horizontal)
  const x = 60;
  const yMid = 320;
  const step = 280;

  const nodes: FlowNode[] = [
    {
      id: makeId(), type: "start", position: { x, y: yMid },
      data: { label: startLabel, trigger: "manual" },
    },
    {
      id: makeId(), type: "whatsapp", position: { x: x + step, y: yMid },
      data: {
        label: welcomeLabel,
        phoneNumber,
        message: welcomeMsg,
        outputVariable: "user_response",
      },
    },
    {
      id: makeId(), type: "ai_agent", position: { x: x + step * 2, y: yMid },
      data: {
        label: aiLabel,
        agentMode: "payment",
        aiProvider: "Mock",
        inputVariable: "user_response",
        outputVariable: "ai_confirmation",
        systemPrompt: aiSystemPrompt,
        prompt: aiPrompt,
      },
    },
    {
      id: makeId(), type: "create_payment", position: { x: x + step * 3, y: yMid },
      data: {
        label: createPaymentLabel,
        provider,
        mode: paymentMode,
        amount,
        currency,
        description: paymentDescription,
        customer: "{{customer_name}}",
        phoneNumber: "{{customer_phone}}",
        orderId: "ord_{{timestamp}}",
        // Configuración específica de PayPhone: integración API Sale + país.
        // Para "API personalizada" se deja vacío (el admin lo configura en el editor).
        ...(provider === "PayPhone" ? { payphoneIntegration: "API Sale", countryCode } : {}),
      },
    },
    {
      id: makeId(), type: "condition", position: { x: x + step * 4, y: yMid },
      data: {
        label: conditionLabel,
        variable: "payment_outcome",
        operator: "equals",
        value: "payment_success",
      },
    },
    {
      id: makeId(), type: "whatsapp", position: { x: x + step * 5, y: yMid - 180 },
      data: {
        label: waSuccessLabel,
        phoneNumber,
        message: paymentSuccessMsg,
      },
    },
    {
      id: makeId(), type: "whatsapp", position: { x: x + step * 5, y: yMid - 60 },
      data: {
        label: waFailedLabel,
        phoneNumber,
        message: paymentFailedMsg,
      },
    },
    {
      id: makeId(), type: "whatsapp", position: { x: x + step * 5, y: yMid + 60 },
      data: {
        label: waPendingLabel,
        phoneNumber,
        message: paymentPendingMsg,
      },
    },
    {
      id: makeId(), type: "whatsapp", position: { x: x + step * 5, y: yMid + 180 },
      data: {
        label: waErrorLabel,
        phoneNumber,
        message: paymentErrorMsg,
      },
    },
    {
      id: makeId(), type: "end", position: { x: x + step * 6, y: yMid },
      data: { label: endLabel, message: endMessage },
    },
  ];

  // Crear edges conectando los nodos
  const [
    startNode, waWelcome, aiNode, payNode, condNode,
    waSuccess, waFailed, waPending, waError, endNode,
  ] = nodes;

  const edges: FlowEdge[] = [
    { id: makeId(), source: startNode.id, target: waWelcome.id, sourceHandle: "out" },
    { id: makeId(), source: waWelcome.id, target: aiNode.id, sourceHandle: "out" },
    { id: makeId(), source: aiNode.id, target: payNode.id, sourceHandle: "out" },
    { id: makeId(), source: payNode.id, target: condNode.id, sourceHandle: "payment_success" },
    { id: makeId(), source: payNode.id, target: waFailed.id, sourceHandle: "payment_failed" },
    { id: makeId(), source: payNode.id, target: waPending.id, sourceHandle: "payment_pending" },
    { id: makeId(), source: payNode.id, target: waError.id, sourceHandle: "error" },
    { id: makeId(), source: condNode.id, target: waSuccess.id, sourceHandle: "true" },
    { id: makeId(), source: condNode.id, target: waError.id, sourceHandle: "false" },
    { id: makeId(), source: waSuccess.id, target: endNode.id, sourceHandle: "out" },
    { id: makeId(), source: waError.id, target: endNode.id, sourceHandle: "out" },
    { id: makeId(), source: waFailed.id, target: endNode.id, sourceHandle: "out" },
    { id: makeId(), source: waPending.id, target: endNode.id, sourceHandle: "out" },
  ];

  return {
    name: workflowName,
    templateType,
    nodes,
    edges,
    currency,
    language: lang,
  };
}
