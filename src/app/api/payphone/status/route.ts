import { NextResponse } from "next/server";
import { getPayPhoneConfig, getPayPhoneStatusMessage } from "@/lib/payphone-config";

/**
 * GET /api/payphone/status
 *
 * Returns the current PayPhone configuration status. NEVER throws, NEVER
 * returns 500. Only called from the PayPhone module view (not from landing).
 *
 * When PAYPHONE_ENV=disabled, returns disabled=true so the frontend shows
 * "PayPhone está desactivado en este entorno."
 */
export async function GET() {
  try {
    const config = getPayPhoneConfig();
    return NextResponse.json({
      configured: config.configured,
      env: config.env,
      disabled: config.disabled,
      apiLinkEnabled: config.apiLinkEnabled,
      apiSaleEnabled: config.apiSaleEnabled,
      userCheckEnabled: config.userCheckEnabled,
      webhookEnabled: config.webhookEnabled,
      storeId: config.storeId,
      credentialMode: "Cuenta Business propia",
      missingVars: config.missingVars,
      error: config.error,
      mockMode: config.mockMode,
      message: getPayPhoneStatusMessage(config),
    });
  } catch (err) {
    console.error("[/api/payphone/status] unexpected error:", err);
    return NextResponse.json({
      configured: false,
      env: "disabled",
      disabled: true,
      apiLinkEnabled: false,
      apiSaleEnabled: false,
      userCheckEnabled: false,
      webhookEnabled: false,
      storeId: null,
      credentialMode: "Cuenta Business propia",
      missingVars: [],
      error: "disabled",
      mockMode: true,
      message: "PayPhone está desactivado en este entorno. Configura credenciales reales en Vercel para probar pagos.",
    });
  }
}

export const dynamic = "force-dynamic";
