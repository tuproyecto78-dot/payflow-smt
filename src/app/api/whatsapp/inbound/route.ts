import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSubscriptionAgent, type SubscriptionAgentStep } from "@/lib/subscription-agent";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/whatsapp/inbound
 *
 * Recibe mensajes entrantes de WhatsApp y responde automáticamente.
 * Busca o crea una conversación, ejecuta el agente de suscripción,
 * y envía la respuesta por WhatsApp.
 *
 * Body:
 *   {
 *     "phone_number": "+593987654321",
 *     "message_text": "hola",
 *     "message_id": "msg_123",
 *     "timestamp": "2026-01-01T00:00:00Z",
 *     "provider": "mock"
 *   }
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    if (!rateLimit(`whatsapp_inbound:${ip}`, 60, 60_000)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const body = await req.json();
    const phoneNumber = sanitizeText(body.phone_number || body.From || "");
    const messageText = sanitizeText(body.message_text || body.Body || "").slice(0, 1000);
    const messageId = sanitizeText(body.message_id || body.MessageSid || "") || null;
    const provider = sanitizeText(body.provider || "mock") || "mock";
    const customerName = sanitizeText(body.customer_name || "");

    if (!phoneNumber || !messageText) {
      return NextResponse.json({ error: "phone_number y message_text son obligatorios." }, { status: 400 });
    }

    // Deduplicación por message_id: si ya existe, no procesar
    if (messageId) {
      const existing = await db.whatsAppMessage.findFirst({
        where: { messageId, direction: "inbound" },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, duplicate: true, message: "Mensaje ya procesado." });
      }
    }

    // Buscar o crear conversación
    let conversation = await db.whatsAppConversation.findFirst({
      where: { phoneNumber, status: "active" },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      conversation = await db.whatsAppConversation.create({
        data: { phoneNumber, currentStep: "greeting", context: JSON.stringify({ customer_name: customerName }), status: "active" },
      });
    }

    // Guardar mensaje entrante
    await db.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        phoneNumber,
        messageText,
        provider,
        messageId,
        status: "received",
      },
    });

    // Parsear contexto de la conversación
    const context = JSON.parse(conversation.context || "{}");
    const currentStep = (conversation.currentStep as SubscriptionAgentStep) || "greeting";

    // Ejecutar agente de suscripción
    const result = runSubscriptionAgent({
      message: messageText,
      data: context,
      step: currentStep,
    });

    // Actualizar conversación
    await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        currentStep: result.step,
        context: JSON.stringify(result.data),
        updatedAt: new Date(),
      },
    });

    let requestCreated = false;

    // Si el agente confirma y está listo para crear la solicitud
    if (result.ready_to_create && result.confirmed) {
      const d = result.data;
      const planInfo = d.selected_plan === "anual"
        ? { label: "Plan Anual", price: 89 }
        : { label: "Plan Trimestral", price: 25 };

      try {
        const score = parseInt(d.readiness_score || "0", 10);
        const created = await db.subscriptionRequest.create({
          data: {
            selectedPlan: d.selected_plan || "trimestral",
            selectedPlanLabel: planInfo.label,
            selectedPlanPrice: planInfo.price,
            fullName: d.full_name || "",
            documentId: d.document_id || "",
            email: d.email || "",
            countryCode: d.country_code || "593",
            phoneNumber: d.phone_number || phoneNumber,
            businessName: d.business_name || "",
            businessType: d.business_type || null,
            country: d.country || null,
            city: d.city || null,
            paymentProvider: d.payment_provider || "PayPhone",
            hasPayphoneBusiness: d.has_payphone_business === "Sí",
            hasWhatsappBusiness: d.has_whatsapp_business === "Sí",
            whatToCharge: d.what_to_charge || null,
            monthlyPayments: d.monthly_payments || null,
            avgAmount: d.avg_amount || null,
            readinessScore: score,
            readinessStatus: d.readiness_status || "incomplete",
            recommendedTemplate: d.recommended_template || null,
            recommendedWorkflowType: d.recommended_workflow_type || null,
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
          metadata: { phone: phoneNumber, plan: d.selected_plan, provider: d.payment_provider, score },
        });
      } catch (err) {
        console.error("[whatsapp/inbound] Error creating request:", err);
      }
    }

    // Enviar respuesta por WhatsApp (usando API interna o mock)
    const replyText = result.reply;
    try {
      await fetch(`${getBaseUrl()}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message_text: replyText,
          conversation_id: conversation.id,
          provider,
        }),
      });
    } catch (err) {
      console.error("[whatsapp/inbound] Error sending reply:", err);
    }

    return NextResponse.json({
      ok: true,
      conversation_id: conversation.id,
      reply: replyText,
      step: result.step,
      request_created: requestCreated,
    });
  } catch (err) {
    console.error("[whatsapp/inbound] error", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
}

export const dynamic = "force-dynamic";
