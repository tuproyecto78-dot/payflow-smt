// PayPhone API Link client for PayFlow SMT.
// Uses the admin's own PayPhone Business account (Token + StoreID).
// Supports sandbox and production environments.
// SECURITY: Tokens are NEVER exposed to the frontend. All API calls are backend-only.

export type PayPhoneEnv = "sandbox" | "production";
export type PayPhoneIntegrationType = "API_LINK" | "API_SALE";
export type PayPhoneCredentialMode = "GLOBAL_ADMIN_ACCOUNT";

export interface PayPhoneConfig {
  env: PayPhoneEnv;
  token: string;
  storeId: string;
  apiLinkEnabled: boolean;
  apiSaleEnabled: boolean;
  userCheckEnabled: boolean;
  webhookEnabled: boolean;
  configured: boolean;
  missingVars: string[];
}

export interface PayPhoneLinkRequest {
  amount: number; // in dollars
  currency: string; // "USD"
  reference: string;
  clientTransactionId: string;
  storeId: string;
  // Optional breakdown (must sum to amount)
  amountWithoutTax?: number;
  amountWithTax?: number;
  tax?: number;
  service?: number;
  tip?: number;
  // Link options
  oneTime?: boolean;
  isAmountEditable?: boolean;
  expireIn?: number; // hours (default 24)
  language?: "es" | "en";
}

export interface PayPhoneLinkResult {
  ok: boolean;
  payment_link: string;
  client_transaction_id: string;
  store_id: string;
  raw_response: Record<string, unknown>;
  error?: string;
}

// Get the current PayPhone configuration from env vars.
// NEVER returns the token value — only whether it's configured.
export function getPayPhoneConfig(): PayPhoneConfig {
  const env: PayPhoneEnv = process.env.PAYPHONE_ENV === "production" ? "production" : "sandbox";
  const token = env === "production" ? process.env.PAYPHONE_PRODUCTION_TOKEN : process.env.PAYPHONE_SANDBOX_TOKEN;
  const storeId = env === "production" ? process.env.PAYPHONE_PRODUCTION_STORE_ID : process.env.PAYPHONE_SANDBOX_STORE_ID;

  const missingVars: string[] = [];
  if (env === "production") {
    if (!process.env.PAYPHONE_PRODUCTION_TOKEN) missingVars.push("PAYPHONE_PRODUCTION_TOKEN");
    if (!process.env.PAYPHONE_PRODUCTION_STORE_ID) missingVars.push("PAYPHONE_PRODUCTION_STORE_ID");
  } else {
    if (!process.env.PAYPHONE_SANDBOX_TOKEN) missingVars.push("PAYPHONE_SANDBOX_TOKEN");
    if (!process.env.PAYPHONE_SANDBOX_STORE_ID) missingVars.push("PAYPHONE_SANDBOX_STORE_ID");
  }

  return {
    env,
    token: token || "",
    storeId: storeId || "",
    apiLinkEnabled: process.env.PAYPHONE_API_LINK_ENABLED !== "false",
    apiSaleEnabled: process.env.PAYPHONE_API_SALE_ENABLED === "true",
    userCheckEnabled: process.env.PAYPHONE_USER_CHECK_ENABLED !== "false",
    webhookEnabled: process.env.PAYPHONE_WEBHOOK_ENABLED !== "false",
    configured: missingVars.length === 0 && !!token && !!storeId,
    missingVars,
  };
}

// Validate that amount equals amountWithoutTax + amountWithTax + tax + service + tip.
// If breakdown is not provided, the full amount goes to amountWithoutTax.
export function validateAmountBreakdown(req: PayPhoneLinkRequest): { ok: boolean; error?: string; breakdown: Required<Pick<PayPhoneLinkRequest, "amountWithoutTax" | "amountWithTax" | "tax" | "service" | "tip">> } {
  const { amount, amountWithoutTax, amountWithTax, tax, service, tip } = req;

  // If no breakdown provided, all goes to amountWithoutTax
  if (amountWithoutTax === undefined && amountWithTax === undefined && tax === undefined && service === undefined && tip === undefined) {
    return {
      ok: true,
      breakdown: {
        amountWithoutTax: Math.round(amount * 100),
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
      },
    };
  }

  const awt = Math.round((amountWithoutTax ?? 0) * 100);
  const awTax = Math.round((amountWithTax ?? 0) * 100);
  const t = Math.round((tax ?? 0) * 100);
  const s = Math.round((service ?? 0) * 100);
  const tp = Math.round((tip ?? 0) * 100);
  const total = Math.round(amount * 100);

  if (awt + awTax + t + s + tp !== total) {
    return {
      ok: false,
      error: `El monto (${total} centavos) no coincide con la suma de amountWithoutTax (${awt}) + amountWithTax (${awTax}) + tax (${t}) + service (${s}) + tip (${tp}) = ${awt + awTax + t + s + tp}.`,
      breakdown: { amountWithoutTax: awt, amountWithTax: awTax, tax: t, service: s, tip: tp },
    };
  }

  return {
    ok: true,
    breakdown: { amountWithoutTax: awt, amountWithTax: awTax, tax: t, service: s, tip: tp },
  };
}

// Generate a short, unique clientTransactionId.
export function generateClientTransactionId(): string {
  const ts = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 6);
  return `pf_${ts}${rand}`;
}

// Create a PayPhone payment link via the API Link endpoint.
// Backend-only. NEVER call this from the frontend.
export async function createPayPhoneLink(req: PayPhoneLinkRequest): Promise<PayPhoneLinkResult> {
  const config = getPayPhoneConfig();

  if (!config.configured) {
    return {
      ok: false,
      payment_link: "",
      client_transaction_id: req.clientTransactionId,
      store_id: req.storeId,
      raw_response: { error: "PayPhone no configurado", missingVars: config.missingVars },
      error: `PayPhone no configurado. Faltan: ${config.missingVars.join(", ")}`,
    };
  }

  if (!config.apiLinkEnabled) {
    return {
      ok: false,
      payment_link: "",
      client_transaction_id: req.clientTransactionId,
      store_id: req.storeId,
      raw_response: { error: "API Link desactivado" },
      error: "PAYPHONE_API_LINK_ENABLED=false. Activa API Link en la configuración.",
    };
  }

  // Validate amount breakdown
  const validation = validateAmountBreakdown(req);
  if (!validation.ok) {
    return {
      ok: false,
      payment_link: "",
      client_transaction_id: req.clientTransactionId,
      store_id: req.storeId,
      raw_response: { error: validation.error },
      error: validation.error,
    };
  }

  // Build the API Link request body
  // PayPhone API Link endpoint: POST https://pay.payphonelab.com/api/v1/payment-links
  const body: Record<string, unknown> = {
    amount: Math.round(req.amount * 100),
    amountWithoutTax: validation.breakdown.amountWithoutTax,
    amountWithTax: validation.breakdown.amountWithTax,
    tax: validation.breakdown.tax,
    service: validation.breakdown.service,
    tip: validation.breakdown.tip,
    currency: req.currency || "USD",
    clientTransactionId: req.clientTransactionId,
    storeId: req.storeId,
    reference: req.reference,
    oneTime: req.oneTime ?? true,
    isAmountEditable: req.isAmountEditable ?? false,
    expireIn: req.expireIn ?? 24,
    language: req.language === "en" ? "en" : "es",
  };

  try {
    const res = await fetch("https://pay.payphonelab.com/api/v1/payment-links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        payment_link: "",
        client_transaction_id: req.clientTransactionId,
        store_id: req.storeId,
        raw_response: { httpStatus: res.status, ...data },
        error: `PayPhone API devolvió ${res.status}: ${(data as { message?: string }).message || "Error desconocido"}`,
      };
    }

    // PayPhone returns a payment link URL in the response
    const link = String(
      (data as { paymentLink?: string; link?: string; paymentUrl?: string; url?: string }).paymentLink ||
      (data as { link?: string }).link ||
      (data as { paymentUrl?: string }).paymentUrl ||
      (data as { url?: string }).url ||
      ""
    );

    return {
      ok: true,
      payment_link: link,
      client_transaction_id: req.clientTransactionId,
      store_id: req.storeId,
      raw_response: { httpStatus: res.status, ...data },
    };
  } catch (err) {
    return {
      ok: false,
      payment_link: "",
      client_transaction_id: req.clientTransactionId,
      store_id: req.storeId,
      raw_response: { error: err instanceof Error ? err.message : String(err) },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Normalize Ecuador phone numbers to the format PayPhone expects.
// +593984112233 → 984112233  (PayPhone API wants the number WITHOUT leading 0 and WITHOUT +593)
// 593984112233  → 984112233
// 0984112233    → 984112233
// 984112233     → 984112233
export function normalizeEcuadorPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Remove country code 593 if present at start
  if (digits.startsWith("593")) {
    digits = digits.slice(3);
  }
  // Remove leading 0 if present (Ecuador mobile numbers are 9 digits starting with 9)
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

// Check if a phone number is registered in PayPhone (optional, for API Sale flow).
// Backend-only. Never blocks payment if check fails — just returns status.
export async function checkPayPhoneUser(
  phoneNumber: string,
  countryCode: string = "593"
): Promise<{ registered: boolean; status: "not_checked" | "registered" | "not_registered" | "check_error"; httpStatus?: number; raw?: unknown }> {
  const config = getPayPhoneConfig();

  // If not configured or user check disabled, return not_checked (don't block)
  if (!config.configured || !config.userCheckEnabled) {
    return { registered: false, status: "not_checked" };
  }

  const normalized = normalizeEcuadorPhone(phoneNumber);
  if (!normalized || normalized.length < 8) {
    return { registered: false, status: "not_checked" };
  }

  try {
    const res = await fetch(
      `https://pay.payphonelab.com/api/v1/users/check/${countryCode}${normalized}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${config.token}` },
      }
    );

    if (res.ok) {
      return { registered: true, status: "registered", httpStatus: res.status };
    }

    // 404 = not registered, 401/403 = auth error
    if (res.status === 404) {
      return { registered: false, status: "not_registered", httpStatus: res.status };
    }

    // Any other error → check_error (don't block payment)
    return { registered: false, status: "check_error", httpStatus: res.status, raw: { httpStatus: res.status } };
  } catch (err) {
    // Network error → check_error (don't block payment)
    return {
      registered: false,
      status: "check_error",
      raw: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

// WhatsApp messages for user check results.
export function payphoneUserCheckMessage(status: "registered" | "not_registered" | "check_error" | "not_checked"): string {
  switch (status) {
    case "registered":
      return "✅ Tu número está registrado en PayPhone. Ahora generaré tu enlace seguro de pago.";
    case "not_registered":
      return "No encontramos este número registrado en PayPhone, pero puedes continuar pagando con tarjeta desde el enlace seguro.";
    case "check_error":
    case "not_checked":
    default:
      return "Continuaremos generando tu enlace seguro de pago.";
  }
}

// Test credentials by making a simple API call (e.g., list payment links with limit=1).
// Backend-only. Returns a sanitized result (no tokens).
export async function testPayPhoneCredentials(): Promise<{ ok: boolean; env: PayPhoneEnv; storeId: string; message: string }> {
  const config = getPayPhoneConfig();
  if (!config.configured) {
    return {
      ok: false,
      env: config.env,
      storeId: "",
      message: `Credenciales no configuradas. Faltan: ${config.missingVars.join(", ")}`,
    };
  }
  try {
    // Use the prepare/get-link endpoint or a simple GET to verify the token works.
    // We'll try listing payment links with a small limit.
    const res = await fetch("https://pay.payphonelab.com/api/v1/payment-links?limit=1", {
      method: "GET",
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (res.ok) {
      return { ok: true, env: config.env, storeId: config.storeId, message: `Conexión exitosa (${config.env}). StoreID: ${config.storeId}.` };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, env: config.env, storeId: config.storeId, message: `Token inválido o sin permisos (${res.status}).` };
    }
    // 404 or other might still mean the token is valid but no links exist yet
    return { ok: true, env: config.env, storeId: config.storeId, message: `Token válido (${res.status}). StoreID: ${config.storeId}.` };
  } catch (err) {
    return {
      ok: false,
      env: config.env,
      storeId: config.storeId,
      message: `Error de red: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Map PayPhone webhook fields to normalized payment status.
// PayPhone Notificación Externa sends:
//   StatusCode: 1=Pending, 2=Canceled, 3=Approved
//   TransactionStatus: "Pending" | "Canceled" | "Approved"
export function mapPayPhoneWebhookStatus(statusCode?: number, transactionStatus?: string): "payment_success" | "payment_failed" | "payment_pending" | "error" {
  // StatusCode = 3 → Approved → payment_success
  if (statusCode === 3) return "payment_success";
  // StatusCode = 2 → Canceled → payment_failed
  if (statusCode === 2) return "payment_failed";
  // StatusCode = 1 → Pending → payment_pending
  if (statusCode === 1) return "payment_pending";

  // TransactionStatus string matching
  if (transactionStatus) {
    const ts = transactionStatus.toLowerCase().trim();
    if (ts === "approved") return "payment_success";
    if (ts === "canceled" || ts === "cancelled") return "payment_failed";
    if (ts === "pending") return "payment_pending";
  }

  // Unknown → error
  return "error";
}

// WhatsApp message template for when a payment link is created.
export function payphoneLinkWhatsAppMessage(amount: number, currency: string, reference: string, paymentLink: string, lang: "es" | "en" = "es"): string {
  if (lang === "en") {
    return `✅ Your payment request is ready.

Amount: $${amount.toFixed(2)} ${currency}
Reference: ${reference}

Pay securely here:
${paymentLink}

When PayPhone confirms the payment, we'll let you know in this chat.`;
  }
  return `✅ Tu solicitud de pago está lista.

Monto: $${amount.toFixed(2)} ${currency}
Referencia: ${reference}

Paga de forma segura aquí:
${paymentLink}

Cuando PayPhone confirme el pago, te avisaremos por este chat.`;
}
