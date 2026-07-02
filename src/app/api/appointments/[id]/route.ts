import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { GENERIC_ERROR } from "@/lib/security";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.status === "string" && VALID_STATUSES.includes(body.status)) data.status = body.status;
    if (typeof body.notes === "string") data.notes = body.notes.slice(0, 1000);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay campos." }, { status: 400 });
    const updated = await db.appointment.update({ where: { id }, data });
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (err) {
    console.error("[appointments PATCH] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
