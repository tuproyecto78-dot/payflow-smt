/**
 * PayFlow SMT — Agente Comercial IA
 *
 * The commercial agent that answers customer questions using:
 *   - Knowledge chunks (from uploaded files + manual text)
 *   - Product catalog (from DB)
 *   - Services + availability rules (from DB)
 *
 * Flow:
 *   1. Receive user_message
 *   2. Detect intent (product_query, availability, appointment, payment, faq, human_handoff)
 *   3. Call appropriate tools (searchProduct, checkStock, checkAvailability, searchKnowledge)
 *   4. Build response using REAL data — never invent
 *   5. If confidence_score < 0.3, set requires_human = true
 *
 * Output (internal — client only sees ai_response):
 *   - ai_response: string (what the client sees)
 *   - intent: string
 *   - next_action: string
 *   - confidence_score: number (0.0 - 1.0)
 *   - requires_human: boolean
 *   - product_id, product_name, price, stock
 *   - service_name, appointment_date, appointment_time
 *   - knowledge_used: string[]
 *   - matched_sources: string[]
 */

import {
  searchKnowledge,
  searchProduct,
  checkAvailability,
  type ToolContext,
} from "@/lib/agent-tools";
import { formatDetectedKnowledgeForPrompt } from "@/lib/knowledge-processor";

// ─── Types ───────────────────────────────────────────────────────────

export type AgentIntent =
  | "product_query"
  | "stock_query"
  | "price_query"
  | "availability_query"
  | "appointment_request"
  | "payment_request"
  | "faq"
  | "business_info"
  | "human_handoff"
  | "greeting"
  | "unknown";

export interface CommercialAgentInput {
  message: string;
  businessName?: string;
  ctx: ToolContext;
  // Conversation history (optional)
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  // Pre-loaded knowledge (optional — if not provided, tools will query DB)
  knowledgeText?: string;
}

export interface CommercialAgentResult {
  ai_response: string;
  intent: AgentIntent;
  next_action: "respond" | "ask_for_appointment" | "create_payment" | "handoff" | "stop";
  confidence_score: number;
  requires_human: boolean;
  product_id: string | null;
  product_name: string | null;
  price: number | null;
  /** Internal stock (never shown to client) */
  stock: number | null;
  /** Public-facing availability: "available" | "unavailable" | "unknown" */
  public_availability: string | null;
  service_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  knowledge_used: string[];
  matched_sources: string[];
}

// ─── Intent detection ────────────────────────────────────────────────

function detectIntent(message: string): AgentIntent {
  const m = message.toLowerCase().trim();

  // Greeting
  if (/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos)/i.test(m)) {
    return "greeting";
  }

  // Human handoff
  if (/(humano|asesor|operador|persona real|hablar con alguien|reclamo|queja|gerente|supervisor)/i.test(m)) {
    return "human_handoff";
  }

  // Payment
  if (/(pagar|pago|cobro|transferir|tarjeta|efectivo|link de pago|cu[aá]nto cuesta|cu[aá]nto vale|precio)/i.test(m)) {
    if (/(precio|cu[aá]nto cuesta|cu[aá]nto vale)/i.test(m)) {
      return "price_query";
    }
    return "payment_request";
  }

  // Appointment
  if (/(cita|agendar|reservar|turno|appointment|horario disponible|agenda)/i.test(m)) {
    if (/(horario|disponible|abren|atienden)/i.test(m)) {
      return "availability_query";
    }
    return "appointment_request";
  }

  // Availability
  if (/(horario|abren|atienden|qu[eé] d[ií]as|est[aá]n abiertos|disponible)/i.test(m)) {
    return "availability_query";
  }

  // Stock
  if (/(stock|inventario|hay disponibles|tienen|cantidad)/i.test(m)) {
    return "stock_query";
  }

  // Product query
  if (/(producto|art[ií]culo|cat[aá]logo|comprar|venden|tienen)/i.test(m)) {
    return "product_query";
  }

  // FAQ / business info
  if (/(d[oó]nde|ubicaci[oó]n|direcci[oó]n|env[ií]o|delivery|garant[ií]a|devoluci[oó]n|pol[ií]tica|c[oó]mo funciona|informaci[oó]n)/i.test(m)) {
    return "faq";
  }

  return "unknown";
}

// ─── Extract entities from message ───────────────────────────────────

function extractDayName(message: string): string | null {
  const days = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const lower = message.toLowerCase();
  for (const day of days) {
    if (lower.includes(day)) return day;
  }
  return null;
}

function extractProductKeyword(message: string): string {
  // Remove common question words and extract the product name
  const cleaned = message
    .toLowerCase()
    .replace(/(?:tienen|hay|venden|quiero|comprar|necesito|busco|cu[aá]nto cuesta|cu[aá]nto vale|el|la|los|las|un|una|de|del|por favor|pf|para m[ií])\s*/g, "")
    .replace(/[?¿!¡]/g, "")
    .trim();
  return cleaned.split(/\s+/).slice(0, 4).join(" ");
}

// ─── Main agent function ─────────────────────────────────────────────

export async function runCommercialAgent(
  input: CommercialAgentInput
): Promise<CommercialAgentResult> {
  const message = (input.message || "").trim();
  const ctx = input.ctx;
  const businessName = input.businessName || "el negocio";

  const result: CommercialAgentResult = {
    ai_response: "",
    intent: "unknown",
    next_action: "respond",
    confidence_score: 0,
    requires_human: false,
    product_id: null,
    product_name: null,
    price: null,
    stock: null,
    public_availability: null,
    service_name: null,
    appointment_date: null,
    appointment_time: null,
    knowledge_used: [],
    matched_sources: [],
  };

  // Step 1: Detect intent
  const intent = detectIntent(message);
  result.intent = intent;

  // Step 2: Handle greeting
  if (intent === "greeting") {
    result.ai_response = `¡Hola! 👋 Bienvenido a ${businessName}. Soy tu asesor virtual. Cuéntame, ¿qué necesitas hoy?`;
    result.confidence_score = 0.9;
    result.next_action = "respond";
    return result;
  }

  // Step 3: Handle human handoff
  if (intent === "human_handoff") {
    result.ai_response = "Entiendo. Voy a conectarle con un asesor humano que le ayudará enseguida. Un momento por favor. 🙏";
    result.confidence_score = 0.95;
    result.requires_human = true;
    result.next_action = "handoff";
    result.matched_sources.push("human_handoff");
    return result;
  }

  // Step 4: Handle product/price/stock queries
  if (intent === "product_query" || intent === "price_query" || intent === "stock_query") {
    const keyword = extractProductKeyword(message);
    const productResult = await searchProduct(keyword, ctx);

    if (productResult.found && productResult.data?.matched?.length > 0) {
      const product = productResult.data.matched[0];
      result.product_id = product.id;
      result.product_name = product.name;
      result.price = product.price;
      result.stock = product.stock;
      // Set public_availability (never show exact stock to client)
      if (product.stock !== undefined && product.stock > 0) {
        result.public_availability = "available";
      } else if (product.stock === 0) {
        result.public_availability = "unavailable";
      } else {
        result.public_availability = "unknown";
      }
      result.matched_sources.push("catalog");

      if (intent === "price_query" || (intent === "product_query" && product.price > 0)) {
        result.ai_response = `Claro 😊, te puedo asesorar con ${product.name}.`;
        if (product.description) result.ai_response += `\n${product.description}`;
        result.ai_response += `\nPrecio: $${product.price} ${product.currency || "USD"}`;
        // STOCK VISIBILITY RULE: never show exact quantities to the client.
        // Only say "Disponible" or "Agotado".
        if (result.public_availability === "available") {
          result.ai_response += `\n✅ Disponible`;
        } else if (result.public_availability === "unavailable") {
          result.ai_response += `\n⚠️ Por ahora está agotado, pero puedo ofrecerte alternativas.`;
        }
        result.ai_response += `\n¿Te interesa? Para recomendarte mejor, cuéntame si lo necesitas para uso personal, trabajo o negocio.`;
        result.confidence_score = 0.9;
      } else if (intent === "stock_query") {
        // STOCK VISIBILITY RULE: don't show exact stock count
        if (result.public_availability === "available") {
          result.ai_response = `Sí, tenemos ${product.name} disponible. ¿Te gustaría más información?`;
        } else if (result.public_availability === "unavailable") {
          result.ai_response = `Lo siento, ${product.name} está agotado por ahora. ¿Te interesa algo más?`;
        } else {
          result.ai_response = `Tenemos ${product.name} disponible. ¿Te gustaría más información?`;
        }
        result.confidence_score = 0.85;
      } else {
        result.ai_response = `Sí, tenemos ${product.name}`;
        if (product.price > 0) result.ai_response += ` por $${product.price} ${product.currency || "USD"}`;
        if (product.description) result.ai_response += `\n${product.description}`;
        result.confidence_score = 0.85;
      }
      return result;
    }

    // No product found — check knowledge
    const knowledgeResult = await searchKnowledge(message, ctx);
    if (knowledgeResult.found && knowledgeResult.data?.matched > 0) {
      result.knowledge_used = knowledgeResult.data.topResults.map((r: any) => r.content);
      result.matched_sources.push("knowledge");
      const topContent = knowledgeResult.data.topResults[0]?.content || "";
      result.ai_response = topContent.split("\n").slice(0, 3).join("\n");
      result.confidence_score = 0.6;
      return result;
    }

    // Nothing found
    result.ai_response = "No tengo esa información exacta en este momento, pero puedo pedir que un asesor te ayude. ¿Quieres que te conecte con alguien del equipo?";
    result.confidence_score = 0.2;
    result.requires_human = true;
    result.next_action = "handoff";
    return result;
  }

  // Step 5: Handle availability query
  if (intent === "availability_query") {
    const dayName = extractDayName(message);
    if (dayName) {
      const availResult = await checkAvailability(dayName, ctx);
      if (availResult.found) {
        result.matched_sources.push("availability");
        if (availResult.data.available) {
          const rules = availResult.data.rules;
          const times = rules.map((r: any) => `${r.startTime}-${r.endTime}`).join(", ");
          result.ai_response = `Sí, atendemos los ${dayName} de ${times}. ¿Te gustaría agendar una cita?`;
          result.confidence_score = 0.9;
          result.next_action = "ask_for_appointment";
          return result;
        } else {
          result.ai_response = `Lo siento, no atendemos los ${dayName}. Nuestros horarios son de lunes a viernes. ¿Te gustaría agendar otro día?`;
          result.confidence_score = 0.8;
          return result;
        }
      }
    }

    // No specific day — search knowledge for hours
    const knowledgeResult = await searchKnowledge(message, ctx);
    if (knowledgeResult.found && knowledgeResult.data?.matched > 0) {
      result.knowledge_used = knowledgeResult.data.topResults.map((r: any) => r.content);
      result.matched_sources.push("knowledge");
      result.ai_response = knowledgeResult.data.topResults[0]?.content || "";
      result.confidence_score = 0.7;
      return result;
    }

    result.ai_response = "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.";
    result.confidence_score = 0.2;
    result.requires_human = true;
    result.next_action = "handoff";
    return result;
  }

  // Step 6: Handle appointment request
  if (intent === "appointment_request") {
    result.ai_response = "¡Perfecto! Para agendar tu cita, necesito algunos datos:\n\n1. ¿Qué servicio te interesa?\n2. ¿Qué día prefieres?\n3. ¿A qué hora te queda mejor?";
    result.confidence_score = 0.85;
    result.next_action = "ask_for_appointment";
    result.service_name = null;
    result.matched_sources.push("appointment");
    return result;
  }

  // Step 7: Handle payment request
  if (intent === "payment_request") {
    result.ai_response = "Para procesar tu pago, te enviaré un link seguro de PayPhone. Solo confirma:\n\n• ¿Qué producto/servicio deseas pagar?\n• ¿Tu número móvil registrado en PayPhone?";
    result.confidence_score = 0.8;
    result.next_action = "create_payment";
    result.matched_sources.push("payment");
    return result;
  }

  // Step 8: Handle FAQ / business info
  if (intent === "faq" || intent === "business_info" || intent === "unknown") {
    const knowledgeResult = await searchKnowledge(message, ctx);
    if (knowledgeResult.found && knowledgeResult.data?.matched > 0) {
      result.knowledge_used = knowledgeResult.data.topResults.map((r: any) => r.content);
      result.matched_sources.push("knowledge");
      // Use the top matched content
      const topContent = knowledgeResult.data.topResults[0]?.content || "";
      result.ai_response = topContent.split("\n").slice(0, 4).join("\n");
      result.confidence_score = 0.65;
      return result;
    }

    // If we have general knowledge (no match but chunks exist)
    if (knowledgeResult.found && knowledgeResult.data?.total > 0) {
      result.knowledge_used = knowledgeResult.data.chunks?.slice(0, 3).map((c: any) => c.content) || [];
      result.matched_sources.push("knowledge");
      result.ai_response = "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.";
      result.confidence_score = 0.25;
      result.requires_human = true;
      result.next_action = "handoff";
      return result;
    }

    // No knowledge at all
    result.ai_response = "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.";
    result.confidence_score = 0.2;
    result.requires_human = true;
    result.next_action = "handoff";
    return result;
  }

  // Fallback
  result.ai_response = "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.";
  result.confidence_score = 0.2;
  result.requires_human = true;
  result.next_action = "handoff";
  return result;
}

// ─── Rules enforcement ───────────────────────────────────────────────

/**
 * Enforces the agent rules after generating a response.
 * Returns the potentially modified result.
 *
 * CRITICAL: The client only sees ai_response. All other fields are internal.
 * The ai_response must NEVER contain:
 *   - exact stock numbers (e.g. "50 en stock")
 *   - JSON
 *   - variable names like {{intent}} or {{confidence_score}}
 *   - internal file names
 *   - technical data
 */
export function enforceAgentRules(result: CommercialAgentResult): CommercialAgentResult {
  // Rule 10: If confidence_score < 0.3, activate requires_human
  if (result.confidence_score < 0.3) {
    result.requires_human = true;
    result.next_action = "handoff";
  }

  // Rule 1-4: Never invent prices/stock/horarios/políticas
  // If matched_sources is empty, don't include specific data
  if (result.matched_sources.length === 0) {
    result.product_id = null;
    result.product_name = null;
    result.price = null;
    result.stock = null;
    result.public_availability = null;
  }

  // Rule 5: Don't sell inactive products (already filtered in searchProduct)

  // Rule 7-8: Never confirm payment_success (only PayPhone webhook does)
  // The agent's response should never say "pago confirmado"
  if (/pago confirmado|payment success|pago exitoso/i.test(result.ai_response)) {
    result.ai_response = "Te enviaré un link de pago. Una vez que pagues desde PayPhone, te confirmaré automáticamente.";
  }

  // Rule 3: Strip any accidental exact stock numbers from the client-facing text
  // This catches cases like "50 en stock", "stock: 50", "50 unidades"
  result.ai_response = result.ai_response
    .replace(/\d+\s*(en stock|unidades?|items?|art[ií]culos?)/gi, "disponible")
    .replace(/stock\s*:\s*\d+/gi, "disponible");

  // Strip any JSON-like content that might have leaked into the response
  if (/^\s*\{.*\}\s*$/s.test(result.ai_response) || /^\s*\[.*\]\s*$/s.test(result.ai_response)) {
    result.ai_response = "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.";
    result.requires_human = true;
    result.next_action = "handoff";
    result.confidence_score = Math.min(result.confidence_score, 0.2);
  }

  // Strip any template variables like {{something}}
  result.ai_response = result.ai_response.replace(/\{\{[^}]+\}\}/g, "").trim();

  return result;
}
