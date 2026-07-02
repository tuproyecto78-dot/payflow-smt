import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = await db.availabilityRule.findMany({ orderBy: { dayOfWeek: "asc" }, take: 100 });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIP(req);
  if (!rateLimit(`availability:${ip}`, 20, 60_000)) return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  try {
    const body = await req.json();
    const dayOfWeek = Number(body.dayOfWeek);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: "dayOfWeek debe ser 0-6." }, { status: 400 });
    }
    const startTime = sanitizeText(body.startTime).slice(0, 10);
    const endTime = sanitizeText(body.endTime).slice(0, 10);
    if (!startTime || !endTime) return NextResponse.json({ error: "startTime y endTime son obligatorios." }, { status: 400 });
    const rule = await db.availabilityRule.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        slotDuration: typeof body.slotDuration === "number" ? body.slotDuration : 30,
        clientId: body.clientId || null,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ ok: true, rule_id: rule.id });
  } catch (err) {
    console.error("[availability POST] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
