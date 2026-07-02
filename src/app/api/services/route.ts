import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const services = await db.service.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIP(req);
  if (!rateLimit(`services:${ip}`, 20, 60_000)) return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  try {
    const body = await req.json();
    const name = sanitizeText(body.name).slice(0, 200);
    if (!name) return NextResponse.json({ error: "name es obligatorio." }, { status: 400 });
    const service = await db.service.create({
      data: {
        name,
        durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : 30,
        price: typeof body.price === "number" ? body.price : 0,
        clientId: body.clientId || null,
        active: body.active !== false,
      },
    });
    void logAudit({ userId: session.userId, action: "service_created", entityType: "service", entityId: service.id, ipAddress: ip, metadata: { name, price: service.price } });
    return NextResponse.json({ ok: true, service_id: service.id });
  } catch (err) {
    console.error("[services POST] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
