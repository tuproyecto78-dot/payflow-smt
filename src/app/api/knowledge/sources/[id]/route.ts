import { NextResponse } from "next/server";
import {
  getKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,
  canAccessSource,
} from "@/lib/knowledge-db";
import { sanitizeText } from "@/lib/security";

/**
 * GET /api/knowledge/sources/[id]
 * Fetch a single knowledge source with its chunks, extractions, and links.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await canAccessSource(id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Not authenticated" ? 401 : 403 }
    );
  }
  const source = await getKnowledgeSource(id);
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ source });
}

/**
 * PATCH /api/knowledge/sources/[id]
 * Update a knowledge source (name, status, processingError, file metadata).
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
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    update.name = sanitizeText(body.name).slice(0, 200);
  }
  if (typeof body.status === "string") {
    const validStatus = ["pending", "processing", "ready", "failed"];
    if (!validStatus.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (typeof body.processingError === "string") {
    update.processingError = body.processingError.slice(0, 1000);
  }
  if (typeof body.fileUrl === "string") {
    update.fileUrl = body.fileUrl.slice(0, 500);
  }
  if (typeof body.originalFileName === "string") {
    update.originalFileName = body.originalFileName.slice(0, 200);
  }
  if (typeof body.mimeType === "string") {
    update.mimeType = body.mimeType.slice(0, 100);
  }

  const source = await updateKnowledgeSource(id, update);
  return NextResponse.json({ source });
}

/**
 * DELETE /api/knowledge/sources/[id]
 * Delete a knowledge source (cascade deletes chunks, extractions, embeddings, links).
 */
export async function DELETE(
  _req: Request,
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
  await deleteKnowledgeSource(id);
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
