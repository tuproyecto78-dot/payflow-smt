import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP, sanitizeText, isValidEmail, isValidPhone, RATE_LIMIT_ERROR } from "@/lib/security";

/**
 * POST /api/data-requests
 * Public endpoint: submit a data subject request (access, rectification, deletion, etc.)
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    if (!rateLimit(`dsr:${ip}`, 3, 60_000)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const body = await req.json();
    const { full_name, email, phone, request_type, message } = body;

    if (!full_name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: "Email inválido." }, { status: 400 });

    const validTypes = ["access", "rectification", "deletion", "opposition", "portability", "other"];
    const type = validTypes.includes(request_type) ? request_type : "other";

    const dsr = await db.dataSubjectRequest.create({
      data: {
        fullName: sanitizeText(full_name).slice(0, 200),
        email: sanitizeText(email).toLowerCase(),
        phone: phone ? sanitizeText(phone).slice(0, 30) : null,
        requestType: type,
        message: message ? sanitizeText(message).slice(0, 2000) : null,
        status: "pending",
      },
    });

    return NextResponse.json({ ok: true, id: dsr.id });
  } catch (err) {
    console.error("[data-requests POST] error:", err);
    return NextResponse.json({ error: "Error al enviar la solicitud." }, { status: 500 });
  }
}

/**
 * GET /api/data-requests
 * Admin-only: list data subject requests.
 */
export async function GET() {
  const { getCurrentUserProfile } = await import("@/lib/auth-server");
  const { isAdmin } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const requests = await db.dataSubjectRequest.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ requests });
}

export const dynamic = "force-dynamic";
