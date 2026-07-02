import { NextResponse } from "next/server";
import {
  checkPayPhoneUser,
  normalizeEcuadorPhone,
  payphoneUserCheckMessage,
  getPayPhoneConfig,
} from "@/lib/payphone-link";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/payphone/check-user
 *
 * Checks if a phone number is registered in PayPhone.
 * Does NOT block payment if the user is not registered — just provides information.
 *
 * Body:
 *   phone_number: string (any Ecuador format: +593984..., 0984..., 984..., 593984...)
 *   country_code?: string (default "593")
 *   client_id?: string
 *   workflow_run_id?: string
 *
 * Returns:
 *   registered: boolean
 *   status: "not_checked" | "registered" | "not_registered" | "check_error"
 *   normalized_phone: string
 *   whatsapp_message: string
 *   can_continue: true  (always — never blocks payment)
 */
export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (!rateLimit(`payphone-check-user:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = sanitizeText(body.phone_number || body.phoneNumber || "").slice(0, 30);
    const countryCode = sanitizeText(body.country_code || body.countryCode || "593").slice(0, 4);
    const clientId = body.client_id ? String(body.client_id).slice(0, 100) : null;
    const workflowRunId = body.workflow_run_id ? String(body.workflow_run_id).slice(0, 100) : null;

    if (!rawPhone) {
      return NextResponse.json(
        { error: "phone_number es obligatorio." },
        { status: 400 }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizeEcuadorPhone(rawPhone);

    if (!normalizedPhone || normalizedPhone.length < 8) {
      return NextResponse.json({
        registered: false,
        status: "not_checked",
        normalized_phone: normalizedPhone || rawPhone,
        whatsapp_message: payphoneUserCheckMessage("not_checked"),
        can_continue: true,
        message: "Número de teléfono inválido o demasiado corto. Se omite la verificación.",
      });
    }

    // Check PayPhone config
    const config = getPayPhoneConfig();

    // Call PayPhone Users Check
    const result = await checkPayPhoneUser(normalizedPhone, countryCode);

    const whatsappMessage = payphoneUserCheckMessage(result.status);

    // Audit log (no tokens, phone partially masked)
    void logAudit({
      action: "payphone_user_check",
      entityType: "payment",
      ipAddress: ip,
      metadata: {
        provider: "PayPhone",
        env: config.env,
        phone_masked: maskPhone(normalizedPhone),
        country_code: countryCode,
        registered: result.registered,
        status: result.status,
        http_status: result.httpStatus || null,
        client_id: clientId,
        workflow_run_id: workflowRunId,
      },
    });

    // Safe console log
    console.log("[payphone/check-user]", {
      env: config.env,
      phone_masked: maskPhone(normalizedPhone),
      status: result.status,
      registered: result.registered,
      http_status: result.httpStatus || null,
    });

    return NextResponse.json({
      registered: result.registered,
      status: result.status,
      normalized_phone: normalizedPhone,
      whatsapp_message: whatsappMessage,
      can_continue: true, // Always true — never blocks payment
      http_status: result.httpStatus || null,
    });
  } catch (err) {
    console.error("[payphone/check-user] error:", err);
    return NextResponse.json(
      {
        registered: false,
        status: "check_error",
        can_continue: true,
        whatsapp_message: "Continuaremos generando tu enlace seguro de pago.",
        error: GENERIC_ERROR,
      },
      { status: 500 }
    );
  }
}

// Mask phone for logs: 984112233 → 984***233
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return phone.slice(0, 3) + "***" + phone.slice(-3);
}
