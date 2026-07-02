import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAuditFromRequest, maskPhone } from "@/lib/audit";

/**
 * POST /api/whatsapp/send
 *
 * Envía un mensaje de WhatsApp al número especificado.
 * Si WHATSAPP_PROVIDER es "mock", solo guarda el mensaje en BD.
 * Si es "meta" (WhatsApp Business API), envía el mensaje real.
 *
 * Body:
 *   {
 *     "phone_number": "+593987654321",
 *     "message_text": "Hola!",
 *     "conversation_id": "conv_123",
 *     "provider": "mock"
 *   }
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    if (!rateLimit(`whatsapp_send:${ip}`, 60, 60_000)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const body = await req.json();
    const phoneNumber = sanitizeText(body.phone_number || "");
    const messageText = sanitizeText(body.message_text || "").slice(0, 4000);
    const conversationId = sanitizeText(body.conversation_id || "") || null;
    const provider = sanitizeText(body.provider || "") || process.env.WHATSAPP_PROVIDER || "mock";

    if (!phoneNumber || !messageText) {
      return NextResponse.json({ error: "phone_number y message_text son obligatorios." }, { status: 400 });
    }

    let messageId: string | null = null;
    let status = "sent";

    // Enviar mensaje real si el proveedor está configurado
    const whatsappProvider = process.env.WHATSAPP_PROVIDER || "mock";
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";

    if (whatsappProvider === "meta" && accessToken && phoneNumberId) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneNumber.replace(/\D/g, ""),
              type: "text",
              text: { body: messageText },
            }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          messageId = data?.messages?.[0]?.id || null;
          status = "sent";
        } else {
          status = "failed";
          console.error("[whatsapp/send] Meta API error:", data);
        }
      } catch (err) {
        status = "failed";
        console.error("[whatsapp/send] Error sending via Meta:", err);
      }
    } else {
      // Modo mock: no enviar nada, solo guardar
      messageId = `mock_${Date.now()}`;
      status = "mock_sent";
    }

    // Guardar mensaje saliente en BD
    const msg = await db.whatsAppMessage.create({
      data: {
        conversationId: conversationId || "no-conversation",
        direction: "outbound",
        phoneNumber,
        messageText,
        provider: whatsappProvider,
        messageId,
        status,
      },
    });

    // Audit log: record that a WhatsApp outbound message was sent. We log
    // ONLY the masked phone number + message length — never the full message
    // text (which may contain PII / payment links).
    void logAuditFromRequest(req, {
      actorRole: "system",
      action: "whatsapp_message_sent",
      entityType: "whatsapp_message",
      entityId: msg.id,
      status: status === "failed" ? "error" : "success",
      metadata: {
        phone_number: maskPhone(phoneNumber),
        conversation_id: conversationId,
        provider: whatsappProvider,
        message_id: messageId,
        status,
        message_length: messageText.length,
      },
    });

    return NextResponse.json({
      ok: true,
      message_id: msg.id,
      provider_message_id: messageId,
      status,
    });
  } catch (err) {
    console.error("[whatsapp/send] error", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
