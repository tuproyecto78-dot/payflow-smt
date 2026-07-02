import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateSuggestedWorkflow } from "@/lib/suggested-workflows";
import { logAudit } from "@/lib/audit";
import { getClientIP, GENERIC_ERROR } from "@/lib/security";

/**
 * POST /api/subscriptions/[id]/create-suggested-workflow
 *
 * Crea un workflow visual sugerido a partir de los datos de la solicitud.
 * Solo el administrador puede ejecutar esta acción.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ip = getClientIP(req);

  try {
    const sub = await db.subscriptionRequest.findUnique({ where: { id } });
    if (!sub) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    // Validar datos mínimos
    if (!sub.businessName || !sub.phoneNumber || !sub.businessType || !sub.selectedPlan) {
      return NextResponse.json({
        error: "Faltan datos mínimos para crear el flujo (business_name, phone_number, business_type, selected_plan).",
      }, { status: 400 });
    }

    // Si ya tiene workflow, verificar si se solicitó reemplazo
    const url = new URL(req.url);
    const replace = url.searchParams.get("replace") === "true";

    if (sub.workflowId && !replace) {
      return NextResponse.json({
        error: "Ya existe un flujo para esta solicitud.",
        existing_workflow_id: sub.workflowId,
      }, { status: 409 });
    }

    // Si se solicitó reemplazo y hay un workflow existente, eliminarlo primero
    if (sub.workflowId && replace) {
      await db.workflow.delete({ where: { id: sub.workflowId } }).catch(() => {});
    }

    // Generar flujo sugerido
    // El campo `language` de Prisma es string; lo reducimos a "es" | "en".
    const lang: "es" | "en" = sub.language === "en" ? "en" : "es";
    const suggested = generateSuggestedWorkflow({
      business_name: sub.businessName,
      phone_number: sub.phoneNumber,
      business_type: sub.businessType || "",
      what_to_charge: sub.whatToCharge,
      selected_plan: sub.selectedPlan,
      payment_provider: sub.paymentProvider || "Mock",
      country: sub.country,
      city: sub.city,
      has_payphone_business: sub.hasPayphoneBusiness,
      has_whatsapp_business: sub.hasWhatsappBusiness,
      language: lang,
      currency: sub.currency,
      locale: sub.locale,
    });

    // Crear o reutilizar proyecto
    let projectId = sub.projectId;
    if (!projectId) {
      const project = await db.project.create({
        data: {
          name: sub.businessName || `Cliente ${sub.fullName}`,
          description: `Canal de pagos — ${suggested.name} — ${sub.selectedPlanLabel || sub.selectedPlan}`,
          userId: session.userId,
        },
      });
      projectId = project.id;
    }

    // Crear workflow
    const workflow = await db.workflow.create({
      data: {
        name: suggested.name,
        projectId,
        nodesJson: JSON.stringify(suggested.nodes),
        edgesJson: JSON.stringify(suggested.edges),
        currency: sub.currency || "USD",
        language: sub.language || "es",
        locale: sub.locale || "es-EC",
      },
    });

    // Actualizar solicitud
    await db.subscriptionRequest.update({
      where: { id },
      data: {
        workflowId: workflow.id,
        projectId,
        recommendedTemplate: suggested.name,
        recommendedWorkflowType: suggested.templateType,
        userId: session.userId,
      },
    });

    // Auditoría
    void logAudit({
      userId: session.userId,
      action: "suggested_workflow_created",
      entityType: "workflow",
      entityId: workflow.id,
      ipAddress: ip,
      metadata: {
        subscription_id: id,
        template: suggested.name,
        template_type: suggested.templateType,
        business_name: sub.businessName,
      },
    });

    return NextResponse.json({
      ok: true,
      workflow_id: workflow.id,
      project_id: projectId,
      template_name: suggested.name,
      template_type: suggested.templateType,
      message: "Flujo sugerido creado correctamente.",
    });
  } catch (err) {
    console.error("[create-suggested-workflow] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
