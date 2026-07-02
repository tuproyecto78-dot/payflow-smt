import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSubscriptionAgent, type SubscriptionAgentStep } from "@/lib/subscription-agent";
import { rateLimit, getClientIP, sanitizeText, sanitizeName, isValidEmail, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/whatsapp/subscription-agent
 *
 * Procesa mensajes de WhatsApp del cliente para solicitar activación
 * de su canal de pagos conversando con un agente IA.
 *
 * El agente recolecta datos uno por uno, muestra resumen,
 * y cuando el cliente confirma, crea la solicitud en subscription_requests.
 *
 * Body:
 *   {
 *     "message": "mensaje del cliente por WhatsApp",
 *     "phone": "+593987654321",
 *     "session": {
 *       "step": "greeting",
 *       "data": { ...datos recolectados... }
 *     }
 *   }
 *
 * Respuesta:
 *   {
 *     "reply": "mensaje para enviar por WhatsApp",
 *     "session": {
 *       "step": "ask_name",
 *       "data": { ... }
 *     },
 *     "request_created": false
 *   }
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    if (!rateLimit(`whatsapp_sub:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const body = await req.json();
    const message = sanitizeText(body.message).slice(0, 1000);
    const session = body.session || { step: "greeting", data: {} };

    const result = runSubscriptionAgent({
      message,
      data: session.data || {},
      step: (session.step as SubscriptionAgentStep) || "greeting",
    });

    let requestCreated = false;

    // Si el agente confirma y está listo para crear la solicitud
    if (result.ready_to_create && result.confirmed) {
      const d = result.data;
      const planInfo = d.selected_plan === "anual"
        ? { label: "Plan Anual", price: 89 }
        : { label: "Plan Trimestral", price: 25 };

      try {
        const created = await db.subscriptionRequest.create({
          data: {
            selectedPlan: d.selected_plan || "trimestral",
            selectedPlanLabel: planInfo.label,
            selectedPlanPrice: planInfo.price,
            fullName: sanitizeName(d.full_name || ""),
            documentId: sanitizeText(d.document_id || ""),
            email: sanitizeText(d.email || "").toLowerCase(),
            countryCode: sanitizeText(d.country_code || "593"),
            phoneNumber: sanitizeText(d.phone_number || ""),
            businessName: sanitizeText(d.business_name || ""),
            businessType: sanitizeText(d.business_type || "") || null,
            country: sanitizeText(d.country || "") || null,
            city: sanitizeText(d.city || "") || null,
            paymentProvider: sanitizeText(d.payment_provider || "PayPhone"),
            hasPayphoneBusiness: d.has_payphone_business === "Sí",
            hasWhatsappBusiness: d.has_whatsapp_business === "Sí",
            requestStatus: "pending_review",
            paymentChannelStatus: "not_started",
          },
        });
        requestCreated = true;
        void logAudit({
          action: "subscription_created_via_whatsapp",
          entityType: "subscription",
          entityId: created.id,
          ipAddress: ip,
          metadata: { phone: body.phone, plan: d.selected_plan, provider: d.payment_provider },
        });
      } catch (err) {
        console.error("[whatsapp/subscription-agent] Error creating request:", err);
        return NextResponse.json({
          reply: "Hubo un error al guardar tu solicitud. Por favor intenta nuevamente en unos minutos.",
          session: { step: "completed", data: result.data },
          request_created: false,
          error: GENERIC_ERROR,
        });
      }
    }

    return NextResponse.json({
      reply: result.reply,
      session: {
        step: result.step,
        data: result.data,
      },
      request_created: requestCreated,
    });
  } catch (err) {
    console.error("[whatsapp/subscription-agent] error", err);
    return NextResponse.json(
      {
        reply: "⚠️ Ocurrió un error. Por favor intenta nuevamente.",
        session: { step: "greeting", data: {} },
        request_created: false,
        error: GENERIC_ERROR,
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
