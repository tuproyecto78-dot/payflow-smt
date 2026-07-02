import { NextResponse } from "next/server";
import { canAccessSource } from "@/lib/knowledge-db";
import { db } from "@/lib/db";

/**
 * PATCH /api/knowledge/sources/[id]/toggle
 * Toggle the active state of all AgentKnowledgeLinks for this source.
 *
 * Body: { active: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await canAccessSource(id, true);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Not authenticated" ? 401 : 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const active = Boolean(body.active);

  await db.agentKnowledgeLink.updateMany({
    where: { knowledgeSourceId: id },
    data: { active },
  });

  return NextResponse.json({ ok: true, active });
}

export const dynamic = "force-dynamic";
