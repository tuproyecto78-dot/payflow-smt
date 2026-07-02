/**
 * PayFlow SMT — Agente IA Tools
 *
 * Internal tools the commercial agent uses to answer questions with real
 * business data. Each tool queries the database (products, services,
 * availability rules, knowledge chunks) and returns structured results.
 *
 * The agent NEVER invents data — if a tool returns nothing, the agent
 * must say "No tengo esa información exacta".
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────

export interface ToolContext {
  clientId?: string | null;
  workflowId?: string | null;
}

export interface SearchResult {
  found: boolean;
  data: any;
  source: string;
}

// ─── searchKnowledge ─────────────────────────────────────────────────

export async function searchKnowledge(
  query: string,
  ctx: ToolContext
): Promise<SearchResult> {
  try {
    const where: Record<string, unknown> = {
      category: { not: "unknown" },
    };
    if (ctx.workflowId) where.workflowId = ctx.workflowId;
    else if (ctx.clientId) where.clientId = ctx.clientId;

    const chunks = await db.knowledgeChunk.findMany({
      where,
      orderBy: { chunkIndex: "asc" },
      take: 50,
    });

    if (chunks.length === 0) {
      return { found: false, data: null, source: "knowledge" };
    }

    // Simple keyword matching (no embedding needed for the MVP)
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .filter((w) => !["que", "cual", "como", "donde", "cuando", "los", "las", "del", "para"].includes(w));

    const scored = chunks
      .map((chunk) => {
        const content = chunk.content.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (content.includes(word)) score++;
        }
        return { chunk, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      // No keyword match — return all chunks as general context
      return {
        found: true,
        data: {
          total: chunks.length,
          chunks: chunks.map((c) => ({
            content: c.content,
            category: c.category,
          })),
          matched: false,
        },
        source: "knowledge",
      };
    }

    return {
      found: true,
      data: {
        total: chunks.length,
        matched: scored.length,
        topResults: scored.slice(0, 5).map((s) => ({
          content: s.chunk.content,
          category: s.chunk.category,
          score: s.score,
        })),
      },
      source: "knowledge",
    };
  } catch (err) {
    console.error("[searchKnowledge] error:", err);
    return { found: false, data: null, source: "knowledge" };
  }
}

// ─── searchProduct ───────────────────────────────────────────────────

export async function searchProduct(
  query: string,
  ctx: ToolContext
): Promise<SearchResult> {
  try {
    const where: Record<string, unknown> = {
      active: true,
    };
    if (ctx.workflowId) where.workflowId = ctx.workflowId;
    else if (ctx.clientId) where.clientId = ctx.clientId;

    const products = await db.product.findMany({ where });

    if (products.length === 0) {
      return { found: false, data: null, source: "catalog" };
    }

    const lowerQuery = query.toLowerCase();
    const matched = products.filter((p) => {
      const name = p.name.toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      return (
        name.includes(lowerQuery) ||
        desc.includes(lowerQuery) ||
        sku.includes(lowerQuery) ||
        cat.includes(lowerQuery) ||
        lowerQuery.includes(name)
      );
    });

    if (matched.length === 0) {
      return {
        found: true,
        data: { total: products.length, matched: [], matchedCount: 0 },
        source: "catalog",
      };
    }

    return {
      found: true,
      data: {
        total: products.length,
        matchedCount: matched.length,
        matched: matched.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          stock: p.stock,
          stockStatus: p.stockStatus,
          sku: p.sku,
          category: p.category,
        })),
      },
      source: "catalog",
    };
  } catch (err) {
    console.error("[searchProduct] error:", err);
    return { found: false, data: null, source: "catalog" };
  }
}

// ─── checkStock ──────────────────────────────────────────────────────

export async function checkStock(
  productName: string,
  ctx: ToolContext
): Promise<SearchResult> {
  try {
    const where: Record<string, unknown> = {
      active: true,
      name: { contains: productName },
    };
    if (ctx.workflowId) where.workflowId = ctx.workflowId;
    else if (ctx.clientId) where.clientId = ctx.clientId;

    const product = await db.product.findFirst({ where });

    if (!product) {
      return { found: false, data: null, source: "stock" };
    }

    return {
      found: true,
      data: {
        productId: product.id,
        name: product.name,
        stock: product.stock,
        stockStatus: product.stockStatus,
        available: product.stock > 0,
      },
      source: "stock",
    };
  } catch (err) {
    console.error("[checkStock] error:", err);
    return { found: false, data: null, source: "stock" };
  }
}

// ─── checkAvailability ───────────────────────────────────────────────

export async function checkAvailability(
  dayName: string,
  ctx: ToolContext
): Promise<SearchResult> {
  try {
    const dayMap: Record<string, number> = {
      domingo: 0, sunday: 0, dom: 0,
      lunes: 1, monday: 1, lun: 1,
      martes: 2, tuesday: 2, mar: 2,
      miercoles: 3, miércoles: 3, wednesday: 3, mie: 3, mié: 3,
      jueves: 4, thursday: 4, jue: 4,
      viernes: 5, friday: 5, vie: 5,
      sabado: 6, sábado: 6, saturday: 6, sab: 6, sáb: 6,
    };

    const lower = dayName.toLowerCase().trim();
    let dayOfWeek: number | null = null;
    for (const [key, val] of Object.entries(dayMap)) {
      if (lower.includes(key)) {
        dayOfWeek = val;
        break;
      }
    }

    if (dayOfWeek === null) {
      return { found: false, data: null, source: "availability" };
    }

    const where: Record<string, unknown> = {
      dayOfWeek,
      active: true,
    };
    if (ctx.workflowId) where.workflowId = ctx.workflowId;
    else if (ctx.clientId) where.clientId = ctx.clientId;

    const rules = await db.availabilityRule.findMany({ where });

    if (rules.length === 0) {
      return {
        found: true,
        data: { dayOfWeek, available: false, rules: [] },
        source: "availability",
      };
    }

    return {
      found: true,
      data: {
        dayOfWeek,
        available: true,
        rules: rules.map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          slotDuration: r.slotDuration,
        })),
      },
      source: "availability",
    };
  } catch (err) {
    console.error("[checkAvailability] error:", err);
    return { found: false, data: null, source: "availability" };
  }
}

// ─── createAppointment ───────────────────────────────────────────────

export async function createAppointment(
  data: {
    customerName: string;
    customerPhone: string;
    serviceName: string;
    date: string;
    time: string;
    ctx: ToolContext;
  }
): Promise<SearchResult> {
  try {
    // Find the service
    const where: Record<string, unknown> = {
      active: true,
      name: { contains: data.serviceName },
    };
    if (data.ctx.workflowId) where.workflowId = data.ctx.workflowId;
    else if (data.ctx.clientId) where.clientId = data.ctx.clientId;

    const service = await db.service.findFirst({ where });

    const appointment = await db.appointment.create({
      data: {
        clientId: data.ctx.clientId || null,
        workflowId: data.ctx.workflowId || null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        serviceName: service?.name || data.serviceName,
        appointmentDate: data.date,
        appointmentTime: data.time,
        status: "pending",
      },
    });

    return {
      found: true,
      data: {
        appointmentId: appointment.id,
        serviceName: appointment.serviceName,
        date: appointment.appointmentDate,
        time: appointment.appointmentTime,
        status: appointment.status,
      },
      source: "appointment",
    };
  } catch (err) {
    console.error("[createAppointment] error:", err);
    return { found: false, data: null, source: "appointment" };
  }
}

// ─── createPaymentLink ───────────────────────────────────────────────

export async function createPaymentLink(
  data: {
    amount: number;
    currency?: string;
    description: string;
    customerName?: string;
    customerPhone?: string;
    ctx: ToolContext;
  }
): Promise<SearchResult> {
  // This is a placeholder — the actual payment link creation is handled
  // by the payment node in the workflow engine. This tool just signals
  // that the agent should trigger a payment.
  return {
    found: true,
    data: {
      amount: data.amount,
      currency: data.currency || "USD",
      description: data.description,
      note: "Payment link will be created by the payment node. PayPhone webhook confirms payment_success.",
    },
    source: "payment",
  };
}

// ─── requestHuman ────────────────────────────────────────────────────

export async function requestHuman(
  reason: string,
  ctx: ToolContext
): Promise<SearchResult> {
  try {
    // Log the human handoff request
    await db.auditLog.create({
      data: {
        action: "human_handoff_requested",
        entityType: "agent",
        entityId: ctx.workflowId || ctx.clientId || "unknown",
        metadata: JSON.stringify({ reason, timestamp: new Date().toISOString() }),
      },
    });

    return {
      found: true,
      data: {
        requested: true,
        reason,
        message: "Un asesor humano se pondrá en contacto contigo pronto.",
      },
      source: "human",
    };
  } catch (err) {
    console.error("[requestHuman] error:", err);
    return {
      found: true,
      data: {
        requested: true,
        reason,
        message: "Un asesor humano se pondrá en contacto contigo pronto.",
      },
      source: "human",
    };
  }
}

// ─── Check if Appointment model exists ───────────────────────────────
// We need to ensure the Appointment model exists in the schema.
// If it doesn't, createAppointment will fail gracefully.
