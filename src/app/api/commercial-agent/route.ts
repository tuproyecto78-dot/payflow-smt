import { NextResponse } from "next/server";
import { runCommercialAgent, type CommercialAgentMode } from "@/lib/commercial-agent";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/commercial-agent
 *
 * Runs the PayFlow Agent (Agente Comercial IA).
 * Detects intent, collects data, and returns next_action.
 *
 * Body:
 *   message: string
 *   mode?: "venta" | "cobro" | "agenda" | "soporte"
 *   context?: Record<string, unknown>
 *   business_name?: string
 *   customer_name?: string
 *   customer_phone?: string
 *   customer_email?: string
 *   product_name?: string
 *   service_name?: string
 *   amount?: number
 *   appointment_date?: string
 *   appointment_time?: string
 *   intent?: string
 *   workflow_id?: string
 *   client_id?: string
 */
export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (!rateLimit(`commercial-agent:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = sanitizeText(body.message || "").slice(0, 2000);
    const mode = (body.mode === "venta" || body.mode === "cobro" || body.mode === "agenda" || body.mode === "soporte")
      ? body.mode : "venta";

    const result = await runCommercialAgent({
      message,
      mode: mode as CommercialAgentMode,
      context: body.context || {},
      business_name: body.business_name,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email,
      product_name: body.product_name,
      service_name: body.service_name,
      amount: typeof body.amount === "number" ? body.amount : 0,
      appointment_date: body.appointment_date,
      appointment_time: body.appointment_time,
      intent: body.intent,
    });

    // Save/update the conversation in AgentConversation table
    try {
      const existing = body.client_id
        ? await db.agentConversation.findFirst({
            where: { clientId: body.client_id, status: "active" },
            orderBy: { createdAt: "desc" },
          })
        : null;

      const messages = existing
        ? JSON.parse(existing.messagesJson || "[]")
        : [];
      messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });
      messages.push({ role: "agent", content: result.reply, timestamp: new Date().toISOString() });

      if (existing) {
        await db.agentConversation.update({
          where: { id: existing.id },
          data: {
            customerName: result.customer_name || existing.customerName,
            customerPhone: result.customer_phone || existing.customerPhone,
            customerEmail: result.customer_email || existing.customerEmail,
            intent: result.intent,
            nextAction: result.next_action,
            productName: result.product_name || existing.productName,
            serviceName: result.service_name || existing.serviceName,
            amount: result.amount || existing.amount,
            status: result.next_action === "request_human" ? "needs_human" : "active",
            messagesJson: JSON.stringify(messages.slice(-50)), // keep last 50 messages
          },
        });
      } else {
        await db.agentConversation.create({
          data: {
            clientId: body.client_id || null,
            workflowId: body.workflow_id || null,
            customerName: result.customer_name,
            customerPhone: result.customer_phone,
            customerEmail: result.customer_email,
            intent: result.intent,
            nextAction: result.next_action,
            productName: result.product_name,
            serviceName: result.service_name,
            amount: result.amount,
            status: result.next_action === "request_human" ? "needs_human" : "active",
            messagesJson: JSON.stringify([
              { role: "user", content: message, timestamp: new Date().toISOString() },
              { role: "agent", content: result.reply, timestamp: new Date().toISOString() },
            ]),
          },
        });
      }
    } catch (dbErr) {
      console.error("[commercial-agent] DB error:", dbErr);
    }

    // Audit log
    void logAudit({
      action: "ai_agent_executed",
      entityType: "commercial_agent",
      ipAddress: ip,
      metadata: {
        intent: result.intent,
        next_action: result.next_action,
        mode,
        has_customer_name: !!result.customer_name,
        has_amount: result.amount > 0,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[commercial-agent] error:", err);
    return NextResponse.json({
      reply: "Lo siento, ocurrió un error. Intenta nuevamente.",
      intent: "info",
      next_action: "end_conversation",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      product_name: "",
      service_name: "",
      amount: 0,
      appointment_date: "",
      appointment_time: "",
      variables: {},
      error: GENERIC_ERROR,
    }, { status: 500 });
  }
}
