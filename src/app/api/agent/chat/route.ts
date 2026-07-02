import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runCommercialAgent, enforceAgentRules } from "@/lib/commercial-agent";

/**
 * POST /api/agent/chat
 *
 * Runs the commercial agent with knowledge tools.
 * Returns structured output (the client only sees ai_response).
 *
 * Body:
 *   {
 *     message: string,
 *     businessName?: string,
 *     workflowId?: string,
 *     clientId?: string,
 *     history?: [{ role, content }]
 *   }
 *
 * Response (internal — client ONLY sees ai_response):
 *   {
 *     ai_response: string,
 *     intent, next_action, confidence_score, requires_human,
 *     product_id, product_name, price, stock, public_availability,
 *     service_name, appointment_date, appointment_time,
 *     knowledge_used: string[], matched_sources: string[]
 *   }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio." },
        { status: 400 }
      );
    }

    const result = await runCommercialAgent({
      message,
      businessName: body.businessName,
      ctx: {
        workflowId: body.workflowId || null,
        clientId: body.clientId || null,
      },
      history: body.history || [],
    });

    // Enforce agent rules (confidence threshold, no inventing data, strip stock, etc.)
    const enforced = enforceAgentRules(result);

    return NextResponse.json(enforced);
  } catch (err) {
    console.error("[/api/agent/chat] error:", err);
    return NextResponse.json(
      {
        ai_response: "No tengo esa información exacta, pero puedo pedir que un asesor te ayude.",
        intent: "unknown",
        next_action: "handoff",
        confidence_score: 0.2,
        requires_human: true,
        product_id: null,
        product_name: null,
        price: null,
        stock: null,
        public_availability: null,
        service_name: null,
        appointment_date: null,
        appointment_time: null,
        knowledge_used: [],
        matched_sources: [],
      },
      { status: 200 }
    );
  }
}

export const dynamic = "force-dynamic";
