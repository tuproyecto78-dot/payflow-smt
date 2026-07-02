/**
 * PayFlow SMT — Knowledge Import
 *
 * Takes detected knowledge (from knowledge-processor) and creates REAL
 * records in the catalog (Product), agenda (Service, AvailabilityRule),
 * and knowledge chunks (FAQ).
 *
 * IMPORTANT: Nothing is created without admin approval. The ImportPreviewModal
 * lets the admin edit/ignore individual items before calling this function.
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────

export interface ImportProduct {
  name: string;
  price?: number;
  currency?: string;
  stock?: number;
  sku?: string;
  category?: string;
  description?: string;
  // Admin controls
  _approved?: boolean;
  _ignored?: boolean;
  _edited?: boolean;
}

export interface ImportService {
  name: string;
  durationMinutes?: number;
  price?: number;
  currency?: string;
  category?: string;
  description?: string;
  _approved?: boolean;
  _ignored?: boolean;
  _edited?: boolean;
}

export interface ImportBusinessHour {
  day: string; // "lunes", "monday", etc.
  open: string; // "09:00" or "9"
  close: string; // "18:00" or "18"
  _approved?: boolean;
  _ignored?: boolean;
}

export interface ImportFaq {
  question: string;
  answer: string;
  _approved?: boolean;
  _ignored?: boolean;
}

export interface ImportPolicy {
  text: string;
  _approved?: boolean;
  _ignored?: boolean;
}

export interface ImportPayload {
  clientId?: string;
  workflowId?: string;
  businessProfileId?: string;
  knowledgeSourceId?: string;
  products: ImportProduct[];
  services: ImportService[];
  business_hours: ImportBusinessHour[];
  faqs: ImportFaq[];
  policies: ImportPolicy[];
  // If true, only save as knowledge chunks (no catalog/agenda records)
  knowledgeOnly?: boolean;
}

export interface ImportResult {
  ok: boolean;
  summary: {
    products_created: number;
    services_created: number;
    availability_rules_created: number;
    faq_chunks_created: number;
    policy_chunks_created: number;
    items_ignored: number;
  };
  warnings: string[];
  errors: string[];
}

// ─── Day name parser ─────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  domingo: 0, sunday: 0, dom: 0, sun: 0,
  lunes: 1, monday: 1, lun: 1, mon: 1,
  martes: 2, tuesday: 2, mar: 2, tue: 2,
  miercoles: 3, miércoles: 3, wednesday: 3, mie: 3, mié: 3, wed: 3,
  jueves: 4, thursday: 4, jue: 4, thu: 4,
  viernes: 5, friday: 5, vie: 5, fri: 5,
  sabado: 6, sábado: 6, saturday: 6, sab: 6, sáb: 6, sat: 6,
};

function parseDay(dayName: string): number | null {
  const lower = dayName.toLowerCase().trim();
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function normalizeTime(time: string): string {
  // "9" → "09:00", "18" → "18:00", "9:30" → "09:30"
  const t = time.trim();
  if (t.includes(":")) {
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
  }
  return `${t.padStart(2, "0")}:00`;
}

// ─── Main import function ────────────────────────────────────────────

export async function importDetectedKnowledge(
  payload: ImportPayload
): Promise<ImportResult> {
  const result: ImportResult = {
    ok: true,
    summary: {
      products_created: 0,
      services_created: 0,
      availability_rules_created: 0,
      faq_chunks_created: 0,
      policy_chunks_created: 0,
      items_ignored: 0,
    },
    warnings: [],
    errors: [],
  };

  const { clientId, workflowId, businessProfileId, knowledgeSourceId } = payload;

  // ─── Knowledge-only mode: save everything as chunks, no catalog/agenda ──
  if (payload.knowledgeOnly) {
    for (const product of payload.products) {
      if (product._ignored) {
        result.summary.items_ignored++;
        continue;
      }
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `PRODUCTO: ${product.name}${product.price !== undefined ? ` — $${product.price}` : ""}${product.stock !== undefined ? ` (stock: ${product.stock})` : ""}`,
        category: "products",
        metadata: product,
      });
    }
    for (const service of payload.services) {
      if (service._ignored) {
        result.summary.items_ignored++;
        continue;
      }
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `SERVICIO: ${service.name}${service.durationMinutes ? ` (${service.durationMinutes} min)` : ""}${service.price !== undefined ? ` — $${service.price}` : ""}`,
        category: "services",
        metadata: service,
      });
    }
    for (const hour of payload.business_hours) {
      if (hour._ignored) {
        result.summary.items_ignored++;
        continue;
      }
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `HORARIO: ${hour.day} ${hour.open}-${hour.close}`,
        category: "business_hours",
        metadata: hour,
      });
    }
    for (const faq of payload.faqs) {
      if (faq._ignored) {
        result.summary.items_ignored++;
        continue;
      }
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `P: ${faq.question}\nR: ${faq.answer}`,
        category: "faq",
        metadata: faq,
      });
      result.summary.faq_chunks_created++;
    }
    for (const policy of payload.policies) {
      if (policy._ignored) {
        result.summary.items_ignored++;
        continue;
      }
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `POLÍTICA: ${policy.text}`,
        category: "policies",
        metadata: policy,
      });
      result.summary.policy_chunks_created++;
    }
    return result;
  }

  // ─── Full import mode: create catalog + agenda + knowledge chunks ──

  // Products → Product table
  for (const product of payload.products) {
    if (product._ignored || !product._approved) {
      result.summary.items_ignored++;
      continue;
    }
    try {
      const hasPrice = product.price !== undefined && product.price > 0;
      const hasStock = product.stock !== undefined && product.stock >= 0;

      if (!hasPrice) {
        result.warnings.push(`Producto "${product.name}": precio pendiente`);
      }
      if (!hasStock) {
        result.warnings.push(`Producto "${product.name}": stock no definido`);
      }

      await db.product.create({
        data: {
          clientId: clientId || null,
          workflowId: workflowId || null,
          name: product.name,
          description: product.description || null,
          price: product.price || 0,
          currency: product.currency || "USD",
          stock: product.stock ?? 0,
          stockStatus: !hasStock
            ? "unknown"
            : product.stock === 0
            ? "unavailable"
            : product.stock <= 5
            ? "low_stock"
            : "available",
          sku: product.sku || null,
          category: product.category || null,
          active: true,
          sourceType: "knowledge_import",
          knowledgeSourceId: knowledgeSourceId || null,
        },
      });
      result.summary.products_created++;
    } catch (err) {
      result.errors.push(`Error creando producto "${product.name}": ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Services → Service table
  for (const service of payload.services) {
    if (service._ignored || !service._approved) {
      result.summary.items_ignored++;
      continue;
    }
    try {
      const hasPrice = service.price !== undefined && service.price > 0;
      if (!hasPrice) {
        result.warnings.push(`Servicio "${service.name}": precio pendiente`);
      }

      await db.service.create({
        data: {
          clientId: clientId || null,
          workflowId: workflowId || null,
          name: service.name,
          description: service.description || null,
          durationMinutes: service.durationMinutes || 30,
          price: service.price || 0,
          currency: service.currency || "USD",
          category: service.category || null,
          active: true,
          sourceType: "knowledge_import",
          knowledgeSourceId: knowledgeSourceId || null,
        },
      });
      result.summary.services_created++;
    } catch (err) {
      result.errors.push(`Error creando servicio "${service.name}": ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Business hours → AvailabilityRule table
  for (const hour of payload.business_hours) {
    if (hour._ignored || !hour._approved) {
      result.summary.items_ignored++;
      continue;
    }
    try {
      const dayOfWeek = parseDay(hour.day);
      if (dayOfWeek === null) {
        result.warnings.push(`Horario "${hour.day}": día no reconocido, ignorado`);
        continue;
      }

      await db.availabilityRule.create({
        data: {
          clientId: clientId || null,
          workflowId: workflowId || null,
          dayOfWeek,
          startTime: normalizeTime(hour.open),
          endTime: normalizeTime(hour.close),
          slotDuration: 30,
          active: true,
          sourceType: "knowledge_import",
          knowledgeSourceId: knowledgeSourceId || null,
        },
      });
      result.summary.availability_rules_created++;
    } catch (err) {
      result.errors.push(`Error creando horario "${hour.day}": ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // FAQs → KnowledgeChunk with category=faq
  for (const faq of payload.faqs) {
    if (faq._ignored || !faq._approved) {
      result.summary.items_ignored++;
      continue;
    }
    try {
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: `P: ${faq.question}\nR: ${faq.answer}`,
        category: "faq",
        metadata: faq,
      });
      result.summary.faq_chunks_created++;
    } catch (err) {
      result.errors.push(`Error creando FAQ: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Policies → KnowledgeChunk with category=policies
  for (const policy of payload.policies) {
    if (policy._ignored || !policy._approved) {
      result.summary.items_ignored++;
      continue;
    }
    try {
      await createKnowledgeChunk({
        knowledgeSourceId,
        clientId,
        workflowId,
        content: policy.text,
        category: "policies",
        metadata: policy,
      });
      result.summary.policy_chunks_created++;
    } catch (err) {
      result.errors.push(`Error creando política: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return result;
}

// ─── Helper: create knowledge chunk ──────────────────────────────────

async function createKnowledgeChunk(data: {
  knowledgeSourceId?: string;
  clientId?: string;
  workflowId?: string;
  content: string;
  category: string;
  metadata?: Record<string, unknown>;
}) {
  // If we don't have a knowledgeSourceId, create a temporary "manual" source
  let sourceId = data.knowledgeSourceId;
  if (!sourceId) {
    const source = await db.knowledgeSource.create({
      data: {
        clientId: data.clientId || null,
        workflowId: data.workflowId || null,
        name: "Importación automática",
        type: "manual",
        status: "ready",
      },
    });
    sourceId = source.id;
  }

  const chunkCount = await db.knowledgeChunk.count({
    where: { knowledgeSourceId: sourceId },
  });

  return db.knowledgeChunk.create({
    data: {
      knowledgeSourceId: sourceId,
      clientId: data.clientId || null,
      workflowId: data.workflowId || null,
      content: data.content,
      category: data.category,
      metadata: JSON.stringify(data.metadata || {}),
      chunkIndex: chunkCount,
    },
  });
}
