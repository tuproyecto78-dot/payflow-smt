import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-server";
import { isAdmin, isClient, isApplicant, ROLES } from "@/lib/roles";
import { importDetectedKnowledge, type ImportPayload } from "@/lib/knowledge-import";

/**
 * POST /api/knowledge/import
 *
 * Takes detected knowledge (from the ImportPreviewModal) and creates real
 * records in Product, Service, AvailabilityRule, and KnowledgeChunk tables.
 *
 * NOTHING is created without admin approval — every item must have
 * _approved=true to be imported.
 *
 * Body:
 *   {
 *     clientId?, workflowId?, businessProfileId?, knowledgeSourceId?,
 *     knowledgeOnly?: boolean,  // if true, only save as knowledge chunks
 *     products: [{ name, price?, stock?, sku?, category?, _approved, _ignored }],
 *     services: [{ name, durationMinutes?, price?, _approved, _ignored }],
 *     business_hours: [{ day, open, close, _approved, _ignored }],
 *     faqs: [{ question, answer, _approved, _ignored }],
 *     policies: [{ text, _approved, _ignored }]
 *   }
 *
 * Response:
 *   { ok, summary: { products_created, services_created, ... }, warnings, errors }
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
  // Only admins and client_owners can import
  if (
    !isAdmin(profile) &&
    !(profile.role === ROLES.CLIENT_OWNER)
  ) {
    return NextResponse.json(
      { error: "Solo el administrador o titular puede importar conocimiento." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    // Client roles are scoped to their own clientId
    const clientId =
      isAdmin(profile) && body.clientId
        ? body.clientId
        : isClient(profile)
        ? profile.clientId
        : body.clientId || null;

    const payload: ImportPayload = {
      clientId: clientId || undefined,
      workflowId: body.workflowId || undefined,
      businessProfileId: body.businessProfileId || undefined,
      knowledgeSourceId: body.knowledgeSourceId || undefined,
      knowledgeOnly: Boolean(body.knowledgeOnly),
      products: Array.isArray(body.products) ? body.products : [],
      services: Array.isArray(body.services) ? body.services : [],
      business_hours: Array.isArray(body.business_hours) ? body.business_hours : [],
      faqs: Array.isArray(body.faqs) ? body.faqs : [],
      policies: Array.isArray(body.policies) ? body.policies : [],
    };

    const result = await importDetectedKnowledge(payload);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/knowledge/import] error:", err);
    return NextResponse.json(
      { ok: false, error: "Error al importar conocimiento." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
