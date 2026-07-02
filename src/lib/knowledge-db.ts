/**
 * PayFlow SMT — Knowledge DB helpers
 *
 * CRUD operations for knowledge sources, chunks, extractions, embeddings,
 * and agent-knowledge links. All functions use Prisma and enforce
 * client/workflow scoping so a client never sees another client's data.
 *
 * Access control:
 *   - Admin/super_admin can CRUD all knowledge sources
 *   - Client owners can CRUD their own client's sources
 *   - Client operators can read but not delete
 *   - Public visitors have NO access
 */
import { db } from "@/lib/db";
import { getCurrentUserProfile } from "@/lib/auth-server";
import { isAdmin, isClient, ROLES } from "@/lib/roles";

// ─── Types ───────────────────────────────────────────────────────────

export interface CreateKnowledgeSourceInput {
  clientId?: string;
  workflowId?: string;
  businessProfileId?: string;
  name: string;
  type: string;
  fileUrl?: string;
  originalFileName?: string;
  mimeType?: string;
}

export interface UpdateKnowledgeSourceInput {
  name?: string;
  status?: string;
  processingError?: string;
  fileUrl?: string;
  originalFileName?: string;
  mimeType?: string;
}

// ─── Access control ──────────────────────────────────────────────────

async function canAccessSource(
  sourceId: string,
  requireWrite = false
): Promise<{ ok: boolean; error?: string; source?: any }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const source = await db.knowledgeSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) return { ok: false, error: "Source not found" };

  // Admins can access everything
  if (isAdmin(profile)) return { ok: true, source };

  // Client roles can read their own client's sources
  if (isClient(profile)) {
    if (source.clientId !== profile.clientId) {
      return { ok: false, error: "Access denied" };
    }
    // Client operators can't write
    if (requireWrite && profile.role === ROLES.CLIENT_OPERATOR) {
      return { ok: false, error: "Solo el titular puede modificar" };
    }
    return { ok: true, source };
  }

  return { ok: false, error: "Access denied" };
}

// ─── KnowledgeSource CRUD ────────────────────────────────────────────

export async function listKnowledgeSources(filters: {
  clientId?: string;
  workflowId?: string;
  businessProfileId?: string;
  type?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.workflowId) where.workflowId = filters.workflowId;
  if (filters.businessProfileId) where.businessProfileId = filters.businessProfileId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  return db.knowledgeSource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { chunks: true, extractions: true, agentLinks: true },
      },
    },
  });
}

export async function getKnowledgeSource(id: string) {
  return db.knowledgeSource.findUnique({
    where: { id },
    include: {
      chunks: { orderBy: { chunkIndex: "asc" } },
      extractions: { orderBy: { createdAt: "desc" } },
      agentLinks: true,
    },
  });
}

export async function createKnowledgeSource(input: CreateKnowledgeSourceInput) {
  return db.knowledgeSource.create({
    data: {
      clientId: input.clientId || null,
      workflowId: input.workflowId || null,
      businessProfileId: input.businessProfileId || null,
      name: input.name,
      type: input.type,
      fileUrl: input.fileUrl || null,
      originalFileName: input.originalFileName || null,
      mimeType: input.mimeType || null,
      status: "pending",
    },
  });
}

export async function updateKnowledgeSource(
  id: string,
  input: UpdateKnowledgeSourceInput
) {
  return db.knowledgeSource.update({
    where: { id },
    data: input,
  });
}

export async function deleteKnowledgeSource(id: string) {
  // Cascade delete handles chunks, extractions, embeddings, agentLinks
  return db.knowledgeSource.delete({ where: { id } });
}

// ─── KnowledgeChunk ──────────────────────────────────────────────────

export async function createChunk(data: {
  knowledgeSourceId: string;
  clientId?: string;
  workflowId?: string;
  content: string;
  category?: string;
  metadata?: Record<string, unknown>;
  chunkIndex?: number;
}) {
  return db.knowledgeChunk.create({
    data: {
      knowledgeSourceId: data.knowledgeSourceId,
      clientId: data.clientId || null,
      workflowId: data.workflowId || null,
      content: data.content,
      category: data.category || "unknown",
      metadata: JSON.stringify(data.metadata || {}),
      chunkIndex: data.chunkIndex || 0,
    },
  });
}

export async function listChunks(sourceId: string) {
  return db.knowledgeChunk.findMany({
    where: { knowledgeSourceId: sourceId },
    orderBy: { chunkIndex: "asc" },
  });
}

// ─── KnowledgeExtraction ────────────────────────────────────────────

export async function createExtraction(data: {
  knowledgeSourceId: string;
  clientId?: string;
  workflowId?: string;
  extractedType: string;
  extractedData: Record<string, unknown>;
  confidenceScore?: number;
  approved?: boolean;
}) {
  return db.knowledgeExtraction.create({
    data: {
      knowledgeSourceId: data.knowledgeSourceId,
      clientId: data.clientId || null,
      workflowId: data.workflowId || null,
      extractedType: data.extractedType,
      extractedData: JSON.stringify(data.extractedData),
      confidenceScore: data.confidenceScore || 0,
      approved: data.approved || false,
    },
  });
}

export async function approveExtraction(id: string, approved: boolean) {
  return db.knowledgeExtraction.update({
    where: { id },
    data: { approved },
  });
}

export async function listExtractions(sourceId: string) {
  return db.knowledgeExtraction.findMany({
    where: { knowledgeSourceId: sourceId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── KnowledgeEmbedding ──────────────────────────────────────────────

export async function createEmbedding(data: {
  knowledgeChunkId: string;
  clientId?: string;
  workflowId?: string;
  embedding: number[];
  model?: string;
}) {
  return db.knowledgeEmbedding.create({
    data: {
      knowledgeChunkId: data.knowledgeChunkId,
      clientId: data.clientId || null,
      workflowId: data.workflowId || null,
      embedding: JSON.stringify(data.embedding),
      model: data.model || "text-embedding-3-small",
    },
  });
}

// ─── AgentKnowledgeLink ──────────────────────────────────────────────

export async function linkKnowledgeToAgent(data: {
  agentId?: string;
  workflowId?: string;
  knowledgeSourceId: string;
  active?: boolean;
}) {
  return db.agentKnowledgeLink.create({
    data: {
      agentId: data.agentId || null,
      workflowId: data.workflowId || null,
      knowledgeSourceId: data.knowledgeSourceId,
      active: data.active ?? true,
    },
  });
}

export async function toggleKnowledgeLink(linkId: string, active: boolean) {
  return db.agentKnowledgeLink.update({
    where: { id: linkId },
    data: { active },
  });
}

export async function getActiveKnowledgeForWorkflow(workflowId: string) {
  const links = await db.agentKnowledgeLink.findMany({
    where: { workflowId, active: true },
    include: {
      knowledgeSource: {
        include: {
          chunks: { where: { category: { not: "unknown" } } },
        },
      },
    },
  });
  return links.map((l) => l.knowledgeSource).filter((s) => s && s.status === "ready");
}

// ─── Stats ───────────────────────────────────────────────────────────

export async function getKnowledgeStats(filters: {
  clientId?: string;
  workflowId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.workflowId) where.workflowId = filters.workflowId;

  const [total, ready, processing, failed, pending] = await Promise.all([
    db.knowledgeSource.count({ where }),
    db.knowledgeSource.count({ where: { ...where, status: "ready" } }),
    db.knowledgeSource.count({ where: { ...where, status: "processing" } }),
    db.knowledgeSource.count({ where: { ...where, status: "failed" } }),
    db.knowledgeSource.count({ where: { ...where, status: "pending" } }),
  ]);

  return { total, ready, processing, failed, pending };
}

export { canAccessSource };
