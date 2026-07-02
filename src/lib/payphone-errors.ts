// PayPhone Error Handler for PayFlow SMT.
// Converts technical PayPhone errors into clear admin messages and simple client messages.
// SECURITY: Never includes tokens, API keys, or raw provider JSON in client-facing messages.

import { db } from "./db";

export type PayPhoneErrorType =
  | "network_error"
  | "invalid_credentials"
  | "provider_unavailable"
  | "api_permission_error"
  | "validation_error"
  | "payment_rejected"
  | "duplicate_transaction"
  | "unknown_error";

export interface PayPhoneErrorInput {
  paymentTransactionId?: string | null;
  statusCode?: number;
  providerMessage?: string;
  rawError?: Record<string, unknown>;
  error?: string; // generic error string from catch
}

export interface PayPhoneErrorResult {
  errorType: PayPhoneErrorType;
  errorCode: string | null;
  statusCode: number | null;
  providerMessage: string | null;
  userMessage: string;
  adminMessage: string;
  retryable: boolean;
  rawError: Record<string, unknown>;
}

// Standard client message — always the same, no technical details.
const CLIENT_MESSAGE =
  "⚠️ No pudimos completar el pago. Puedes intentar nuevamente o comunicarte con el negocio.";

// Classify a PayPhone error based on HTTP status code, provider message, and error string.
export function classifyPayPhoneError(input: PayPhoneErrorInput): PayPhoneErrorResult {
  const { statusCode, providerMessage, rawError, error } = input;
  const pm = (providerMessage || "").toLowerCase();
  const errMsg = (error || "").toLowerCase();

  let errorType: PayPhoneErrorType = "unknown_error";
  let errorCode: string | null = null;
  let adminMessage = "Error desconocido al procesar el pago con PayPhone.";
  let retryable = false;

  // Network error (fetch failed, timeout, connection refused)
  if (
    errMsg.includes("fetch failed") ||
    errMsg.includes("econnrefused") ||
    errMsg.includes("timeout") ||
    errMsg.includes("network") ||
    errMsg.includes("enotfound") ||
    errMsg.includes("etimedout")
  ) {
    errorType = "network_error";
    errorCode = "NETWORK_ERROR";
    adminMessage = "Error de red hacia PayPhone. No se pudo conectar con pay.payphonelab.com. Verifica la conectividad de internet del servidor.";
    retryable = true;
  }
  // 401 Unauthorized → invalid token
  else if (statusCode === 401) {
    errorType = "invalid_credentials";
    errorCode = "INVALID_TOKEN";
    adminMessage = "Token de PayPhone inválido o expirado. Verifica PAYPHONE_PRODUCTION_TOKEN en las variables de entorno.";
    retryable = false;
  }
  // 403 Forbidden → API permission error
  else if (statusCode === 403) {
    errorType = "api_permission_error";
    errorCode = "PERMISSION_DENIED";
    // Check if it's about API Link not being enabled
    if (pm.includes("link") || pm.includes("api link") || pm.includes("not enabled") || pm.includes("no habilitad")) {
      adminMessage = "API Link no está habilitada en tu cuenta PayPhone. Activa API Link en el panel de PayPhone Developer.";
    } else if (pm.includes("store") || pm.includes("comercio")) {
      adminMessage = "StoreID incorrecto o sin permisos. Verifica PAYPHONE_PRODUCTION_STORE_ID en las variables de entorno.";
    } else {
      adminMessage = "Permiso denegado por PayPhone (403). Tu cuenta no tiene permisos para esta operación. Revisa la configuración de tu cuenta PayPhone Business.";
    }
    retryable = false;
  }
  // 404 Not Found → provider unavailable or endpoint wrong
  else if (statusCode === 404) {
    errorType = "provider_unavailable";
    errorCode = "ENDPOINT_NOT_FOUND";
    adminMessage = "PayPhone devolvió 404. El endpoint de API Link podría haber cambiado o el StoreID no existe.";
    retryable = false;
  }
  // 400 Bad Request → validation error
  else if (statusCode === 400) {
    errorType = "validation_error";
    errorCode = "BAD_REQUEST";
    // Try to give a more specific message
    if (pm.includes("amount") || pm.includes("monto")) {
      adminMessage = "Monto mal calculado. Verifica que amount = amountWithoutTax + amountWithTax + tax + service + tip (en centavos).";
    } else if (pm.includes("currency") || pm.includes("moneda")) {
      adminMessage = "Moneda no soportada por PayPhone. PayPhone solo acepta USD.";
    } else if (pm.includes("store") || pm.includes("comercio")) {
      adminMessage = "StoreID incorrecto. Verifica PAYPHONE_PRODUCTION_STORE_ID.";
    } else if (pm.includes("duplicate") || pm.includes("duplicad")) {
      errorType = "duplicate_transaction";
      errorCode = "DUPLICATE";
      adminMessage = "Transacción duplicada. El clientTransactionId ya fue usado en PayPhone.";
      retryable = false;
    } else {
      adminMessage = `Error de validación de PayPhone (400): ${providerMessage || "datos inválidos"}. Revisa los campos enviados.`;
    }
    retryable = false;
  }
  // 409 Conflict → duplicate
  else if (statusCode === 409) {
    errorType = "duplicate_transaction";
    errorCode = "CONFLICT";
    adminMessage = "Transacción duplicada. El clientTransactionId ya fue usado en PayPhone.";
    retryable = false;
  }
  // 500 / 502 / 503 → provider unavailable
  else if (statusCode && statusCode >= 500) {
    errorType = "provider_unavailable";
    errorCode = `HTTP_${statusCode}`;
    adminMessage = `PayPhone no está disponible (${statusCode}). El servicio de PayPhone está caído o con problemas. Intenta más tarde.`;
    retryable = true;
  }
  // Payment rejected by provider (check provider message)
  else if (
    pm.includes("rejected") ||
    pm.includes("rechazad") ||
    pm.includes("declined") ||
    pm.includes("insufficient") ||
    pm.includes("saldo insuficiente")
  ) {
    errorType = "payment_rejected";
    errorCode = "PAYMENT_REJECTED";
    adminMessage = "Pago rechazado por PayPhone. Posible saldo insuficiente o tarjeta inválida del cliente.";
    retryable = false;
  }
  // Sandbox inactive error
  else if (pm.includes("sandbox") && pm.includes("inactive")) {
    errorType = "invalid_credentials";
    errorCode = "SANDBOX_INACTIVE";
    adminMessage = "Ambiente sandbox inactivo. Si estás en producción, verifica que PAYPHONE_ENV=production. Si estás en sandbox, activa tu cuenta sandbox en PayPhone Developer.";
    retryable = false;
  }
  // Generic error with message
  else if (error || providerMessage) {
    errorType = "unknown_error";
    errorCode = statusCode ? `HTTP_${statusCode}` : "UNKNOWN";
    adminMessage = `Error de PayPhone: ${providerMessage || error || "desconocido"}. Revisa la configuración de PayPhone.`;
    retryable = false;
  }

  return {
    errorType,
    errorCode,
    statusCode: statusCode ?? null,
    providerMessage: providerMessage || null,
    userMessage: CLIENT_MESSAGE,
    adminMessage,
    retryable,
    rawError: sanitizeRawError(rawError || {}),
  };
}

// Save a payment error to the database.
export async function savePaymentError(
  input: PayPhoneErrorInput,
  result: PayPhoneErrorResult
): Promise<string> {
  try {
    const record = await db.paymentError.create({
      data: {
        paymentTransactionId: input.paymentTransactionId || null,
        provider: "PayPhone",
        errorType: result.errorType,
        errorCode: result.errorCode,
        statusCode: result.statusCode,
        providerMessage: result.providerMessage,
        userMessage: result.userMessage,
        adminMessage: result.adminMessage,
        retryable: result.retryable,
        rawError: JSON.stringify(result.rawError),
      },
    });
    return record.id;
  } catch (err) {
    console.error("[payphone-errors] Failed to save error:", err);
    return "";
  }
}

// Sanitize raw error to remove any sensitive fields.
function sanitizeRawError(raw: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = [
    "token", "access_token", "authorization", "authorization_code",
    "api_key", "apikey", "secret", "password", "bearer",
  ];
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// Helper: wrap a PayPhone operation and catch errors with proper classification.
export async function withPayPhoneErrorHandler<T>(
  paymentTransactionId: string | null,
  operation: () => Promise<T>,
  onError?: (result: PayPhoneErrorResult) => void
): Promise<{ ok: true; data: T } | { ok: false; error: PayPhoneErrorResult }> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (err) {
    const errorInput: PayPhoneErrorInput = {
      paymentTransactionId,
      error: err instanceof Error ? err.message : String(err),
      rawError: { error: err instanceof Error ? err.message : String(err) },
    };
    const result = classifyPayPhoneError(errorInput);
    void savePaymentError(errorInput, result);
    if (onError) onError(result);
    return { ok: false, error: result };
  }
}
