import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-server";
import { isAdmin, isClient, isApplicant } from "@/lib/roles";
import {
  listKnowledgeSources,
  createKnowledgeSource,
} from "@/lib/knowledge-db";
import { sanitizeText } from "@/lib/security";

/**
 * GET /api/knowledge/sources
 * List knowledge sources filtered by clientId/workflowId/type/status.
 *
 * Access:
 *   - Admin/super_admin: can see all sources
 *   - Client owner/operator: can see their client's sources
 *   - Applicant: 403
 */
export async function GET(req: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isApplicant(profile)) {
    return NextResponse.json(
      { error: "Acceso denegado. Suscripción no activa." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const filters: Record<string, string | undefined> = {
    workflowId: url.searchParams.get("workflowId") || undefined,
    businessProfileId: url.searchParams.get("businessProfileId") || undefined,
    type: url.searchParams.get("type") || undefined,
    status: url.searchParams.get("status") || undefined,
  };

  // Client roles are scoped to their own clientId
  if (isClient(profile) && profile.clientId) {
    filters.clientId = profile.clientId;
  } else if (isAdmin(profile)) {
    filters.clientId = url.searchParams.get("clientId") || undefined;
  }

  const sources = await listKnowledgeSources(filters);
  return NextResponse.json({ sources });
}

/**
 * POST /api/knowledge/sources
 * Create a new knowledge source.
 *
 * Access:
 *   - Admin/super_admin: can create for any client
 *   - Client owner: can create for their own client
 *   - Client operator: read-only (403)
 *   - Applicant: 403
 */
export async function POST(req: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isApplicant(profile)) {
    return NextResponse.json(
      { error: "Acceso denegado. Suscripción no activa." },
      { status: 403 }
    );
  }
  if (profile.role === "client_operator") {
    return NextResponse.json(
      { error: "Solo el titular puede crear fuentes de conocimiento." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = sanitizeText(body.name || "").slice(0, 200);
  const type = sanitizeText(body.type || "manual").slice(0, 50);

  if (!name) {
    return NextResponse.json(
      { error: "El nombre es obligatorio." },
      { status: 400 }
    );
  }

  // Validate type
  const validTypes = [
    "pdf", "excel", "csv", "txt", "manual",
    "faq", "policy", "catalog", "business_info",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Tipo inválido. Válidos: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Client roles are scoped to their own clientId
  const clientId =
    isAdmin(profile) && body.clientId
      ? body.clientId
      : isClient(profile)
      ? profile.clientId
      : null;

  const source = await createKnowledgeSource({
    clientId: clientId || undefined,
    workflowId: body.workflowId || undefined,
    businessProfileId: body.businessProfileId || undefined,
    name,
    type,
    fileUrl: body.fileUrl ? String(body.fileUrl).slice(0, 500) : undefined,
    originalFileName: body.originalFileName
      ? String(body.originalFileName).slice(0, 200)
      : undefined,
    mimeType: body.mimeType ? String(body.mimeType).slice(0, 100) : undefined,
  });

  return NextResponse.json({ source }, { status: 201 });
}

export const dynamic = "force-dynamic";
