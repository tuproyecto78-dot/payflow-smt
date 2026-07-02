import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP, sanitizeText, isValidEmail, RATE_LIMIT_ERROR } from "@/lib/security";

/**
 * POST /api/consent-logs
 * Records consent when a user accepts privacy/terms in the subscription form.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    if (!rateLimit(`consent:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const body = await req.json();
    const { subscription_request_id, client_id, full_name, email, phone, privacy_policy_accepted, terms_accepted, marketing_accepted } = body;

    if (!full_name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    if (!privacy_policy_accepted || !terms_accepted) {
      return NextResponse.json({ error: "Debes aceptar la Política de Privacidad y los Términos." }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || null;
    const privacyVersion = process.env.PRIVACY_POLICY_VERSION || "1.0";
    const termsVersion = process.env.TERMS_VERSION || "1.0";

    const log = await db.consentLog.create({
      data: {
        subscriptionRequestId: subscription_request_id || null,
        clientId: client_id || null,
        fullName: sanitizeText(full_name).slice(0, 200),
        email: sanitizeText(email).toLowerCase(),
        phone: phone ? sanitizeText(phone).slice(0, 30) : null,
        privacyPolicyAccepted: Boolean(privacy_policy_accepted),
        termsAccepted: Boolean(terms_accepted),
        marketingAccepted: Boolean(marketing_accepted),
        privacyPolicyVersion: privacyVersion,
        termsVersion: termsVersion,
        ipAddress: ip,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });

    return NextResponse.json({ ok: true, id: log.id });
  } catch (err) {
    console.error("[consent-logs POST] error:", err);
    return NextResponse.json({ error: "Error al registrar el consentimiento." }, { status: 500 });
  }
}

/**
 * GET /api/consent-logs
 * Admin-only: list consent logs.
 */
export async function GET() {
  const { getCurrentUserProfile } = await import("@/lib/auth-server");
  const { isAdmin } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const logs = await db.consentLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ logs });
}

export const dynamic = "force-dynamic";
