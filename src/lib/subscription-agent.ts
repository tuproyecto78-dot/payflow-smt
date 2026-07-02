// Agente de suscripción por WhatsApp para PayFlow SMT — PayFlow Activación 24H.
// El cliente conversa por WhatsApp para solicitar activación de su canal de pagos.
// La IA recolecta datos uno por uno, valida, calcula readiness score,
// recomienda plantilla, muestra resumen y crea la solicitud.
//
// Multilingual (es/en) + multicurrency (USD/EUR/MXN/COP/PEN) support.
// Language and currency are collected explicitly during the conversation;
// sensible defaults are auto-detected from the user's country so callers
// that don't pass language still get Spanish behavior identical to before.

import {
  t,
  type Language,
} from "@/lib/i18n/strings";
import {
  detectCurrencyFromCountry,
  formatMoney,
  isSupportedCurrency,
} from "@/lib/i18n/currencies";
import { detectLocaleFromCountry } from "@/lib/i18n/locales";

export type SubscriptionAgentStep =
  | "greeting" | "ask_name" | "ask_document" | "ask_email" | "ask_country_code"
  | "ask_phone" | "ask_business_name" | "ask_business_type" | "ask_country"
  | "ask_language" | "ask_city"
  | "ask_plan" | "ask_provider" | "ask_payphone_business" | "ask_whatsapp_business"
  | "ask_what_to_charge" | "ask_monthly_payments" | "ask_avg_amount"
  | "ask_currency" | "show_summary" | "ask_confirmation" | "completed";

export interface SubscriptionAgentInput {
  message: string;
  data: Record<string, string | undefined>;
  step: SubscriptionAgentStep;
}

export interface SubscriptionAgentResult {
  reply: string;
  data: Record<string, string | undefined>;
  step: SubscriptionAgentStep;
  confirmed: boolean;
  ready_to_create: boolean;
}

// Shape of the message bundle returned by getMessages(lang).
// Mirrors the keys the original hard-coded MESSAGES constant exposed,
// plus the new ask_language / ask_currency / confirm_question / cancelled
// / invalid_email / invalid_phone entries needed for the multilingual flow.
export interface SubscriptionMessages {
  greeting: string;
  ask_name: string;
  ask_document: string;
  ask_email: string;
  ask_country_code: string;
  ask_phone: string;
  ask_business_name: string;
  ask_business_type: string;
  ask_country: string;
  ask_city: string;
  ask_language: string;
  ask_currency: string;
  ask_plan: string;
  ask_provider: string;
  ask_payphone_business: string;
  ask_whatsapp_business: string;
  ask_what_to_charge: string;
  ask_monthly_payments: string;
  ask_avg_amount: string;
  confirmation_received: string;
  invalid: string;
  invalid_email: string;
  invalid_phone: string;
  confirm_question: string;
  cancelled: string;
}

// Build the localized message bundle for the requested language.
// Falls back to Spanish ("es") for unknown codes.
export function getMessages(lang: Language = "es"): SubscriptionMessages {
  return {
    greeting: t("sub.greeting", lang),
    ask_name: t("sub.ask_name", lang),
    ask_document: t("sub.ask_document", lang),
    ask_email: t("sub.ask_email", lang),
    ask_country_code: t("sub.ask_country_code", lang),
    ask_phone: t("sub.ask_phone", lang),
    ask_business_name: t("sub.ask_business_name", lang),
    ask_business_type: t("sub.ask_business_type", lang),
    ask_country: t("sub.ask_country", lang),
    ask_city: t("sub.ask_city", lang),
    ask_language: t("sub.ask_language", lang),
    ask_currency: t("sub.ask_currency", lang),
    ask_plan: t("sub.ask_plan", lang),
    ask_provider: t("sub.ask_provider", lang),
    ask_payphone_business: t("sub.ask_payphone_business", lang),
    ask_whatsapp_business: t("sub.ask_whatsapp_business", lang),
    ask_what_to_charge: t("sub.ask_what_to_charge", lang),
    ask_monthly_payments: t("sub.ask_monthly_payments", lang),
    ask_avg_amount: t("sub.ask_avg_amount", lang),
    confirmation_received: t("sub.confirmation_received", lang),
    invalid: t("sub.invalid", lang),
    invalid_email: t("sub.invalid_email", lang),
    invalid_phone: t("sub.invalid_phone", lang),
    confirm_question: t("sub.confirm_question", lang),
    cancelled: t("sub.cancelled", lang),
  };
}

// Backward-compat: existing callers that do MESSAGES.greeting still work.
// Equivalent to getMessages("es") — Spanish behavior identical to before.
const MESSAGES: SubscriptionMessages = getMessages("es");

// Plan / provider / yes-no / charge option maps (language-neutral values).
const PLAN_MAP: Record<string, { value: string; label: string; price: number }> = {
  "1": { value: "trimestral", label: "Plan Trimestral", price: 25 },
  "2": { value: "anual", label: "Plan Anual", price: 89 },
};
const PROVIDER_MAP: Record<string, string> = { "1": "PayPhone", "2": "DEUNA", "3": "Stripe", "4": "Otro", "5": "Todavía no tengo" };
const YESNO_MAP: Record<string, string> = { "1": "Sí", "2": "No", "3": "En proceso", "sí": "Sí", "si": "Sí", "no": "No", "en proceso": "En proceso", "yes": "Sí" };
const CHARGE_MAP: Record<string, string> = { "1": "pedidos", "2": "citas", "3": "servicios", "4": "productos", "5": "cuotas", "6": "reservas", "7": "facturas" };

// Language picker (1=es, 2=en) + tolerant aliases.
const LANGUAGE_MAP: Record<string, Language> = {
  "1": "es",
  "2": "en",
  "es": "es",
  "en": "en",
  "español": "es",
  "espanol": "es",
  "spanish": "es",
  "english": "en",
  "ingles": "en",
  "inglés": "en",
};

// Currency picker (1-5 supported codes, 6 = Other/keep default).
const CURRENCY_MAP: Record<string, string | undefined> = {
  "1": "USD",
  "2": "EUR",
  "3": "MXN",
  "4": "COP",
  "5": "PEN",
  "6": undefined, // "Other" — keep the auto-detected default
  "usd": "USD",
  "eur": "EUR",
  "mxn": "MXN",
  "cop": "COP",
  "pen": "PEN",
};

// Resolve a locale for the chosen language, honoring the detected country
// when the user picked Spanish. English always falls back to en-US.
function resolveLocale(lang: Language, country?: string): string {
  if (lang === "en") return "en-US";
  return detectLocaleFromCountry(country);
}

// Resolve the language to use for the current turn from data.
function langOf(data: Record<string, string | undefined>): Language {
  const l = data.language as Language | undefined;
  return l === "en" ? "en" : "es";
}

export function runSubscriptionAgent(input: SubscriptionAgentInput): SubscriptionAgentResult {
  const { message, data, step } = input;
  const msg = message.trim();
  const lower = msg.toLowerCase();
  const newData = { ...data };

  // Resolve the active language for this turn. The language may change mid-flow
  // (after ask_language) — we re-read it before composing each reply.
  let lang = langOf(newData);
  let messages = getMessages(lang);

  if (step === "greeting") {
    if (/^(s[iíí]|claro|acepto|ok|d[aá]le|empezar|continuar|yes|y|start|begin|hol[aa]|hello|hola)/i.test(lower)) {
      return ok(messages.ask_name, newData, "ask_name");
    }
    return ok(messages.greeting, newData, "greeting");
  }

  switch (step) {
    case "ask_name":
      if (msg.length < 3) return err(messages.invalid + " " + messages.ask_name, newData, step);
      newData.full_name = msg.slice(0, 100);
      return ok(messages.ask_document, newData, "ask_document");

    case "ask_document":
      if (msg.length < 5) return err(messages.invalid + " " + messages.ask_document, newData, step);
      newData.document_id = msg.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
      return ok(messages.ask_email, newData, "ask_email");

    case "ask_email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg)) return err(messages.invalid_email + " " + messages.ask_email, newData, step);
      newData.email = msg.toLowerCase().trim();
      return ok(messages.ask_country_code, newData, "ask_country_code");

    case "ask_country_code": {
      const code = msg.replace(/\D/g, "").slice(0, 4);
      if (!code) return err(messages.invalid + " " + messages.ask_country_code, newData, step);
      newData.country_code = code;
      return ok(messages.ask_phone, newData, "ask_phone");
    }

    case "ask_phone": {
      const phone = msg.replace(/[^0-9+]/g, "").slice(0, 15);
      if (phone.length < 7) return err(messages.invalid_phone + " " + messages.ask_phone, newData, step);
      newData.phone_number = phone;
      return ok(messages.ask_business_name, newData, "ask_business_name");
    }

    case "ask_business_name":
      if (msg.length < 2) return err(messages.invalid + " " + messages.ask_business_name, newData, step);
      newData.business_name = msg.slice(0, 100);
      return ok(messages.ask_business_type, newData, "ask_business_type");

    case "ask_business_type":
      newData.business_type = msg.slice(0, 50);
      return ok(messages.ask_country, newData, "ask_country");

    case "ask_country": {
      newData.country = msg.slice(0, 50);
      // Auto-detect currency + locale defaults from the country.
      // The user can override the currency later in ask_currency.
      newData.currency = detectCurrencyFromCountry(newData.country);
      newData.locale = detectLocaleFromCountry(newData.country);
      return ok(messages.ask_language, newData, "ask_language");
    }

    case "ask_language": {
      const picked = LANGUAGE_MAP[lower] || LANGUAGE_MAP[msg];
      const newLang: Language = picked === "en" ? "en" : "es";
      newData.language = newLang;
      // Refresh locale for the chosen language (keeps country match for Spanish).
      newData.locale = resolveLocale(newLang, newData.country);
      // Re-resolve the message bundle for subsequent turns.
      lang = newLang;
      messages = getMessages(lang);
      return ok(messages.ask_city, newData, "ask_city");
    }

    case "ask_city":
      if (msg.length < 2) return err(messages.invalid + " " + messages.ask_city, newData, step);
      newData.city = msg.slice(0, 50);
      return ok(messages.ask_plan, newData, "ask_plan");

    case "ask_plan": {
      const plan = PLAN_MAP[lower] || PLAN_MAP[msg];
      if (!plan) return err(messages.invalid + " " + messages.ask_plan, newData, step);
      newData.selected_plan = plan.value;
      return ok(messages.ask_provider, newData, "ask_provider");
    }

    case "ask_provider": {
      const provider = PROVIDER_MAP[msg] || PROVIDER_MAP[lower];
      if (!provider) return err(messages.invalid + " " + messages.ask_provider, newData, step);
      newData.payment_provider = provider;
      return ok(messages.ask_payphone_business, newData, "ask_payphone_business");
    }

    case "ask_payphone_business": {
      const ppVal = YESNO_MAP[msg] || YESNO_MAP[lower];
      if (!ppVal) return err(messages.invalid + " " + messages.ask_payphone_business, newData, step);
      newData.has_payphone_business = ppVal;
      return ok(messages.ask_whatsapp_business, newData, "ask_whatsapp_business");
    }

    case "ask_whatsapp_business": {
      const waVal = YESNO_MAP[msg] || YESNO_MAP[lower];
      if (!waVal) return err(messages.invalid + " " + messages.ask_whatsapp_business, newData, step);
      newData.has_whatsapp_business = waVal;
      return ok(messages.ask_what_to_charge, newData, "ask_what_to_charge");
    }

    case "ask_what_to_charge": {
      const charge = CHARGE_MAP[msg] || CHARGE_MAP[lower];
      if (!charge) return err(messages.invalid + " " + messages.ask_what_to_charge, newData, step);
      newData.what_to_charge = charge;
      return ok(messages.ask_monthly_payments, newData, "ask_monthly_payments");
    }

    case "ask_monthly_payments":
      if (msg.length < 1) return err(messages.invalid + " " + messages.ask_monthly_payments, newData, step);
      newData.monthly_payments = msg.replace(/[^0-9]/g, "").slice(0, 10);
      return ok(messages.ask_avg_amount, newData, "ask_avg_amount");

    case "ask_avg_amount":
      if (msg.length < 1) return err(messages.invalid + " " + messages.ask_avg_amount, newData, step);
      newData.avg_amount = msg.replace(/[^0-9.]/g, "").slice(0, 20);
      // Ask currency next (defaults already detected from country).
      return ok(messages.ask_currency, newData, "ask_currency");

    case "ask_currency": {
      const mapped = CURRENCY_MAP[lower] ?? CURRENCY_MAP[msg];
      if (mapped) {
        newData.currency = mapped;
      } else if (/^[a-z]{3}$/i.test(msg) && isSupportedCurrency(msg.toUpperCase())) {
        // Allow direct entry of a supported ISO 4217 code (e.g. "CLP", "BRL").
        newData.currency = msg.toUpperCase();
      }
      // If "Other" (option 6) or invalid input, keep the auto-detected default.
      if (!newData.currency) newData.currency = "USD";
      // Show summary with score + recommended template.
      const score = calculateReadinessScore(newData);
      const status = getReadinessStatus(score);
      const template = getRecommendedTemplate(newData.business_type, newData.what_to_charge);
      newData.readiness_score = String(score);
      newData.readiness_status = status;
      newData.recommended_template = template.label;
      newData.recommended_workflow_type = template.type;
      const summary = buildSummary(newData, score, status, template.label, lang);
      return { reply: summary, data: newData, step: "ask_confirmation", confirmed: false, ready_to_create: false };
    }

    case "ask_confirmation":
      if (/^(s[iíí]|claro|acepto|confirmo|ok|d[aá]le|sí confirmo|yes|y|confirm)/i.test(lower)) {
        return { reply: messages.confirmation_received, data: newData, step: "completed", confirmed: true, ready_to_create: true };
      }
      if (/^(no|cancelar|no confirmo|cancel|don't|dont)/i.test(lower)) {
        return { reply: messages.cancelled, data: newData, step: "completed", confirmed: false, ready_to_create: false };
      }
      return { reply: messages.confirm_question, data: newData, step: "ask_confirmation", confirmed: false, ready_to_create: false };

    default:
      return ok(messages.greeting, newData, "greeting");
  }

  function ok(reply: string, data: Record<string, string | undefined>, step: SubscriptionAgentStep): SubscriptionAgentResult {
    return { reply, data, step, confirmed: false, ready_to_create: false };
  }
  function err(reply: string, data: Record<string, string | undefined>, step: SubscriptionAgentStep): SubscriptionAgentResult {
    return { reply, data, step, confirmed: false, ready_to_create: false };
  }
}

export function calculateReadinessScore(data: Record<string, string | undefined>): number {
  let score = 0;
  // 8 mandatory fields × 10 = 80
  if (data.full_name) score += 10;
  if (data.document_id) score += 10;
  if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) score += 10;
  if (data.phone_number && data.phone_number.length >= 7) score += 10;
  if (data.business_name) score += 10;
  if (data.business_type) score += 10;
  if (data.selected_plan) score += 10;
  if (data.payment_provider) score += 10;
  // Country+city = 5
  if (data.country && data.city) score += 5;
  // Country code = 5
  if (data.country_code) score += 5;
  // Bonuses = 10 total
  if (data.has_whatsapp_business === "Sí") score += 5;
  if (data.has_payphone_business === "Sí") score += 5;
  return Math.min(score, 100);
}

export function getReadinessStatus(score: number): string {
  if (score === 100) return "fully_ready";
  if (score >= 80) return "ready_to_activate";
  if (score >= 50) return "needs_review";
  return "incomplete";
}

export function getMissingFields(data: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (!data.full_name) missing.push("nombres_completos");
  if (!data.document_id) missing.push("cedula_dni");
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) missing.push("correo_electronico");
  if (!data.country_code) missing.push("codigo_pais");
  if (!data.phone_number || data.phone_number.length < 7) missing.push("numero_celular");
  if (!data.business_name) missing.push("nombre_negocio");
  if (!data.business_type) missing.push("tipo_negocio");
  if (!data.country || !data.city) missing.push("pais_ciudad");
  if (!data.selected_plan) missing.push("plan");
  if (!data.payment_provider) missing.push("proveedor_pago");
  if (data.has_whatsapp_business !== "Sí") missing.push("whatsapp_business");
  if (data.has_payphone_business !== "Sí") missing.push("payphone_business");
  return missing;
}

export function getReadinessRecommendation(score: number, missing: string[], lang: Language = "es"): string {
  if (score === 100) return t("readiness.fully_ready", lang);
  if (score >= 80) return t("readiness.ready_to_activate", lang);
  if (missing.includes("payphone_business")) return t("readiness.needs_payphone", lang);
  if (missing.includes("whatsapp_business")) return t("readiness.needs_whatsapp", lang);
  if (score < 50) return t("readiness.incomplete", lang);
  return t("readiness.needs_more", lang);
}

export function getRecommendedTemplate(businessType?: string, whatToCharge?: string): { label: string; type: string } {
  const bt = (businessType || "").toLowerCase();
  const wtc = whatToCharge || "";
  if (bt.includes("restaurante") || wtc === "pedidos") return { label: "Cobro de pedidos por WhatsApp", type: "orders" };
  if (bt.includes("clínica") || bt.includes("salud") || wtc === "citas") return { label: "Cobro de citas por WhatsApp", type: "appointments" };
  if (bt.includes("tienda") || wtc === "productos") return { label: "Cobro de productos por WhatsApp", type: "products" };
  if (bt.includes("educación") || wtc === "cuotas") return { label: "Cobro de matrícula o mensualidad", type: "tuition" };
  if (bt.includes("delivery")) return { label: "Cobro de pedido y confirmación", type: "delivery" };
  if (wtc === "facturas") return { label: "Cobro de facturas por WhatsApp", type: "invoices" };
  return { label: "Cobro general por WhatsApp", type: "general" };
}

// Language display name in the user's own language.
const LANG_DISPLAY: Record<Language, string> = { es: "Español", en: "English" };

// Build the localized summary shown to the user before asking for confirmation.
// Uses summary.* translation keys and formats the average amount with the
// selected currency/locale via formatMoney.
function buildSummary(
  data: Record<string, string | undefined>,
  score: number,
  status: string,
  template: string,
  lang: Language = "es",
): string {
  const plan =
    data.selected_plan === "anual"
      ? (lang === "en" ? "Annual Plan — $89" : "Plan Anual — $89")
      : (lang === "en" ? "Quarterly Plan — $25" : "Plan Trimestral — $25");
  const phoneLine = data.phone_number ? `+${data.country_code || ""} ${data.phone_number}`.trim() : "—";
  const avgFormatted = formatMoney(Number(data.avg_amount || 0), data.currency, data.locale);
  const languageLabel = LANG_DISPLAY[lang] || data.language || "—";

  return `${t("summary.title", lang)}

👤 ${t("summary.name", lang)}: ${data.full_name || "—"}
📄 ${t("summary.document", lang)}: ${data.document_id || "—"}
📧 ${t("summary.email", lang)}: ${data.email || "—"}
📱 ${t("summary.phone", lang)}: ${phoneLine}
🏢 ${t("summary.business", lang)}: ${data.business_name || "—"}
📦 ${t("summary.type", lang)}: ${data.business_type || "—"}
📍 ${t("summary.location", lang)}: ${data.country || "—"}, ${data.city || "—"}
🌐 ${t("summary.language", lang)}: ${languageLabel}
💰 ${t("summary.currency", lang)}: ${data.currency || "—"}
💳 ${t("summary.plan", lang)}: ${plan}
🏦 ${t("summary.provider", lang)}: ${data.payment_provider || "—"}
📱 ${t("summary.payphone", lang)}: ${data.has_payphone_business || "—"}
💬 ${t("summary.whatsapp", lang)}: ${data.has_whatsapp_business || "—"}
🛒 ${t("summary.what_charge", lang)}: ${data.what_to_charge || "—"}
📊 ${t("summary.monthly", lang)}: ${data.monthly_payments || "—"}
💰 ${t("summary.avg_amount", lang)}: ${avgFormatted}

📊 ${t("summary.score", lang)}: ${score}/100 (${status})
📋 ${t("summary.template", lang)}: ${template}

${t("summary.confirm", lang)}`;
}

export { MESSAGES };
