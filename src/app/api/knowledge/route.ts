import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createKnowledgeSource } from "@/lib/knowledge";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await db.knowledgeSource.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIP(req);
  if (!rateLimit(`knowledge:${ip}`, 20, 60_000)) return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  try {
    const body = await req.json();
    const name = sanitizeText(body.name).slice(0, 200);
    const type = sanitizeText(body.type || "manual").slice(0, 30);
    const content = String(body.content || "").slice(0, 100000);
    if (!name) return NextResponse.json({ error: "name es obligatorio." }, { status: 400 });
    const result = await createKnowledgeSource({ name, type: type as any, content, clientId: body.clientId, fileUrl: body.fileUrl });
    void logAudit({ userId: session.userId, action: "knowledge_source_created", entityType: "knowledge", entityId: result.sourceId, ipAddress: ip, metadata: { name, type, chunk_count: result.chunkCount } });
    return NextResponse.json({ ok: true, source_id: result.sourceId, chunk_count: result.chunkCount });
  } catch (err) {
    console.error("[knowledge POST] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
