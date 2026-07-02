import { NextResponse } from "next/server";
import { logAuditFromRequest, maskPhone } from "@/lib/audit";

/**
 * GET /api/whatsapp/webhook
 *
 * Verificación del webhook de WhatsApp Business Cloud API.
 * Meta envía hub.mode, hub.verify_token y hub.challenge.
 * Si el token coincide con WHATSAPP_VERIFY_TOKEN, responde con hub.challenge.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[whatsapp/webhook GET] WHATSAPP_VERIFY_TOKEN no configurado");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[whatsapp/webhook GET] Verificación exitosa");
    // Responder con el challenge como texto plano
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.error("[whatsapp/webhook GET] Verificación fallida");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 *
 * Recibe eventos de WhatsApp Business Cloud API.
 * Procesa mensajes entrantes, ejecuta el Agente IA, y responde automáticamente.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Log seguro (sin tokens)
    console.log("[whatsapp/webhook POST] Evento recibido");

    // Extraer mensajes desde la estructura de Meta
    const entries = body?.entry || [];
    let processed = 0;

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Procesar mensajes entrantes
        const messages = value?.messages || [];
        const contacts = value?.contacts || [];

        for (const msg of messages) {
          const messageId = msg?.id;
          const from = msg?.from; // número de teléfono del cliente
          const timestamp = msg?.timestamp;
          const type = msg?.type;
          const textBody = msg?.text?.body || msg?.button?.text || "";

          // Extraer nombre del contacto si está disponible
          let customerName = "";
          if (contacts.length > 0) {
            customerName = contacts[0]?.profile?.name || contacts[0]?.wa_id || "";
          }

          if (!messageId || !from || !textBody) {
            console.log("[whatsapp/webhook POST] Mensaje sin datos suficientes, ignorando");
            continue;
          }

          // Sanitizar mensaje
          const sanitizedText = String(textBody).slice(0, 1000);

          // Audit log: record that a WhatsApp message was received from a
          // customer. We log ONLY the masked phone, conversation/customer id,
          // message id, provider, and message length — never the full message
          // text (which may contain PII / payment details).
          void logAuditFromRequest(req, {
            actorRole: "provider",
            action: "whatsapp_message_received",
            entityType: "whatsapp_message",
            entityId: messageId,
            status: "success",
            metadata: {
              phone_number: maskPhone(from),
              conversation_id: customerName,
              message_id: messageId,
              provider: "meta",
              message_length: sanitizedText.length,
            },
          });

          // Llamar a la API interna de inbound para procesar
          try {
            const baseUrl =
              process.env.NEXT_PUBLIC_APP_URL ||
              process.env.VERCEL_URL ||
              "http://localhost:3000";

            const res = await fetch(`${baseUrl}/api/whatsapp/inbound`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone_number: from,
                message_text: sanitizedText,
                message_id: messageId,
                timestamp: timestamp,
                provider: "meta",
                customer_name: customerName,
              }),
            });

            if (res.ok) {
              processed++;
              console.log(`[whatsapp/webhook POST] Mensaje ${messageId} procesado OK`);
            } else {
              console.error(`[whatsapp/webhook POST] Error procesando mensaje ${messageId}: ${res.status}`);
            }
          } catch (err) {
            console.error(`[whatsapp/webhook POST] Error llamando inbound:`, err);
          }
        }

        // Procesar status updates (delivered, read, etc.) — solo log
        const statuses = value?.statuses || [];
        if (statuses.length > 0) {
          console.log(`[whatsapp/webhook POST] ${statuses.length} status updates recibidos`);
        }
      }
    }

    // Meta requiere respuesta 200 OK rápido
    return NextResponse.json({ ok: true, processed }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp/webhook POST] error:", err);
    // Responder 200 para que Meta no reintente
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export const dynamic = "force-dynamic";
