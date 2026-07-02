/**
 * PayFlow SMT — PayPhone configuration helper.
 *
 * Single source of truth for whether PayPhone is configured, what
 * environment it's in, and what credentials to use.
 *
 * NEVER throws — always returns a valid config object so callers can't
 * crash the app.
 *
 * Modes:
 *   - "disabled"        → PayPhone fully off, no calls, no validation
 *   - "production"      → uses PAYPHONE_PRODUCTION_TOKEN / STORE_ID
 *   - "sandbox"         → uses PAYPHONE_SANDBOX_TOKEN / STORE_ID
 *   - "not_configured"  → PAYPHONE_ENV empty or invalid (treated as disabled in dev)
 */

export type PayPhoneEnv =
  | "production"
  | "sandbox"
  | "disabled"
  | "not_configured";

export interface PayPhoneConfig {
  configured: boolean;
  env: PayPhoneEnv;
  token: string | null;
  storeId: string | null;
  apiLinkEnabled: boolean;
  apiSaleEnabled: boolean;
  userCheckEnabled: boolean;
  webhookEnabled: boolean;
  missingVars: string[];
  error: "sandbox_inactive" | "production_not_configured" | "no_env" | "disabled" | null;
  mockMode: boolean;
  /** True when PayPhone is explicitly disabled — app should never call PayPhone. */
  disabled: boolean;
}

export function isDevOrPreview(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.PAYFLOW_PREVIEW_MODE === "true") return true;
  if (process.env.VERCEL_ENV === "preview") return true;
  return false;
}

export function getPayPhoneConfig(): PayPhoneConfig {
  const rawEnv = (process.env.PAYPHONE_ENV || "").toLowerCase().trim();
  const isDev = isDevOrPreview();

  // Feature flags
  const apiLinkEnabled = process.env.PAYPHONE_API_LINK_ENABLED !== "false";
  const apiSaleEnabled = process.env.PAYPHONE_API_SALE_ENABLED === "true";
  const userCheckEnabled = process.env.PAYPHONE_USER_CHECK_ENABLED !== "false";
  const webhookEnabled = process.env.PAYPHONE_WEBHOOK_ENABLED !== "false";

  let env: PayPhoneEnv;
  let token: string | null = null;
  let storeId: string | null = null;
  let missingVars: string[] = [];
  let error: PayPhoneConfig["error"] = null;
  let disabled = false;

  if (rawEnv === "disabled") {
    // PayPhone explicitly disabled — no calls, no validation, no errors.
    env = "disabled";
    disabled = true;
    error = "disabled";
  } else if (rawEnv === "production") {
    env = "production";
    token = process.env.PAYPHONE_PRODUCTION_TOKEN || null;
    storeId = process.env.PAYPHONE_PRODUCTION_STORE_ID || null;
    if (!token) missingVars.push("PAYPHONE_PRODUCTION_TOKEN");
    if (!storeId) missingVars.push("PAYPHONE_PRODUCTION_STORE_ID");
    if (missingVars.length > 0) error = "production_not_configured";
  } else if (rawEnv === "sandbox") {
    env = "sandbox";
    token = process.env.PAYPHONE_SANDBOX_TOKEN || null;
    storeId = process.env.PAYPHONE_SANDBOX_STORE_ID || null;
    if (!token) missingVars.push("PAYPHONE_SANDBOX_TOKEN");
    if (!storeId) missingVars.push("PAYPHONE_SANDBOX_STORE_ID");
    if (missingVars.length > 0) error = "sandbox_inactive";
  } else {
    // PAYPHONE_ENV empty or invalid → treat as disabled in dev, not_configured in prod.
    env = "not_configured";
    if (isDev) {
      disabled = true;
      error = "disabled";
    } else {
      error = "no_env";
      missingVars = ["PAYPHONE_ENV"];
    }
  }

  const configured = !disabled && !!token && !!storeId && env !== "not_configured" && env !== "disabled";

  return {
    configured,
    env,
    token,
    storeId,
    apiLinkEnabled: configured && apiLinkEnabled,
    apiSaleEnabled: configured && apiSaleEnabled,
    userCheckEnabled: configured && userCheckEnabled,
    webhookEnabled: configured && webhookEnabled,
    missingVars,
    error,
    mockMode: !configured && isDev,
    disabled,
  };
}

export function getPayPhoneStatusMessage(config: PayPhoneConfig): string {
  if (config.disabled) {
    return "PayPhone está desactivado en este entorno. Configura credenciales reales en Vercel para probar pagos.";
  }
  if (config.configured) {
    return config.env === "production"
      ? "PayPhone está configurado en modo Producción."
      : "PayPhone está configurado en modo Sandbox.";
  }
  if (config.mockMode) {
    return "PayPhone no está disponible en este entorno. Puedes continuar usando el simulador.";
  }
  if (config.error === "sandbox_inactive") {
    return "Sandbox no configurado o inactivo.";
  }
  if (config.error === "production_not_configured") {
    return "Producción no configurada.";
  }
  return "PayPhone no está configurado.";
}
