import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  recommendWorkflowTemplateFromKnowledge,
  TEMPLATE_INFO,
  type RecommendedTemplate,
} from "@/lib/knowledge-recommender";

/**
 * POST /api/knowledge/recommend
 *
 * Analyzes detected knowledge and recommends the best workflow template.
 *
 * Body:
 *   {
 *     detected: DetectedKnowledge,
 *     paymentRequired?: boolean,
 *     reservationPayment?: boolean
 *   }
 *
 * Response:
 *   {
 *     recommended_template, reason, detected_modules, missing_data, confidence_score,
 *     template_name, template_info, suggested_config
 *   }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const detected = body.detected || {};
    const result = recommendWorkflowTemplateFromKnowledge(detected, {
      paymentRequired: body.paymentRequired,
      reservationPayment: body.reservationPayment,
    });

    const tplInfo = TEMPLATE_INFO[result.recommended_template];

    // Build suggested_config for the UI to apply automatically
    const suggested_config = buildSuggestedConfig(result.recommended_template);

    return NextResponse.json({
      ...result,
      template_name: tplInfo.name,
      template_info: tplInfo,
      suggested_config,
    });
  } catch (err) {
    console.error("[/api/knowledge/recommend] error:", err);
    return NextResponse.json(
      {
        recommended_template: "solo_ia",
        reason: "No se pudo analizar el conocimiento. Recomendamos empezar con Solo IA.",
        detected_modules: [],
        missing_data: [],
        confidence_score: 0.3,
        template_name: "Solo IA (sin pagos)",
        template_info: {
          name: "Solo IA (sin pagos)",
          description: "WhatsApp + IA + respuesta + humano.",
          modules: ["IA"],
        },
        suggested_config: buildSuggestedConfig("solo_ia"),
      },
      { status: 200 }
    );
  }
}

function buildSuggestedConfig(template: RecommendedTemplate) {
  switch (template) {
    case "solo_ia":
      return {
        uses_catalog: false,
        uses_agenda: false,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "completo",
      };
    case "ia_catalogo":
      return {
        uses_catalog: true,
        uses_agenda: false,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "vender",
      };
    case "ia_agenda":
      return {
        uses_catalog: false,
        uses_agenda: true,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "agendar",
      };
    case "ia_payphone":
      return {
        uses_catalog: false,
        uses_agenda: false,
        payment_required: true,
        payment_provider: "payphone",
        agent_mode: "cobrar",
      };
    case "ia_agenda_payphone":
      return {
        uses_catalog: false,
        uses_agenda: true,
        payment_required: true,
        payment_provider: "payphone",
        agent_mode: "agendar",
      };
    case "agente_completo":
      return {
        uses_catalog: true,
        uses_agenda: true,
        payment_required: true,
        payment_provider: "payphone",
        agent_mode: "completo",
      };
    default:
      return {
        uses_catalog: false,
        uses_agenda: false,
        payment_required: false,
        payment_provider: "none",
        agent_mode: "completo",
      };
  }
}

export const dynamic = "force-dynamic";
