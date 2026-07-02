import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { GENERIC_ERROR } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.slice(0, 200);
    if (typeof body.durationMinutes === "number") data.durationMinutes = body.durationMinutes;
    if (typeof body.price === "number") data.price = body.price;
    if (typeof body.active === "boolean") data.active = body.active;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay campos." }, { status: 400 });
    const updated = await db.service.update({ where: { id }, data });
    return NextResponse.json({ ok: true, service: updated });
  } catch (err) {
    console.error("[services PATCH] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await db.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[services DELETE] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
