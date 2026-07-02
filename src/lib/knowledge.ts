// Biblioteca de conocimientos para PayFlow SMT.
// Permite al Agente Comercial IA responder con información real del negocio.
// Uses simple keyword matching (no external embedding API needed for sandbox).

import { db } from "./db";

export interface KnowledgeSourceInput {
  clientId?: string;
  name: string;
  type: "manual" | "pdf" | "csv" | "excel" | "txt" | "faq" | "policy";
  content: string;
  fileUrl?: string;
}

export interface KnowledgeSearchResult {
  found: boolean;
  context: string;
  confidenceScore: number; // 0-1
  sourceName?: string;
  chunksUsed: number;
}

// Create a knowledge source + auto-chunk the content.
export async function createKnowledgeSource(input: KnowledgeSourceInput): Promise<{ sourceId: string; chunkCount: number }> {
  const source = await db.knowledgeSource.create({
    data: {
      clientId: input.clientId || null,
      name: input.name,
      type: input.type,
      content: input.content,
      fileUrl: input.fileUrl || null,
      status: "active",
    },
  });

  // Split content into chunks of ~500 chars with overlap
  const chunks = chunkText(input.content, 500, 50);

  // Save chunks
  for (let i = 0; i < chunks.length; i++) {
    await db.knowledgeChunk.create({
      data: {
        sourceId: source.id,
        clientId: input.clientId || null,
        content: chunks[i],
        metadata: JSON.stringify({ source_name: input.name, type: input.type, position: i }),
      },
    });
  }

  return { sourceId: source.id, chunkCount: chunks.length };
}

// Split text into chunks of approximately `size` chars with `overlap` chars between chunks.
export function chunkText(text: string, size = 500, overlap = 50): string[] {
  if (!text || text.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    // Try to break at a sentence or word boundary
    let chunk = text.slice(start, end);
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(" ");
      if (lastSpace > size * 0.5) {
        chunk = chunk.slice(0, lastSpace);
      }
    }
    chunks.push(chunk.trim());
    start += chunk.length - overlap;
    if (start >= end) break;
  }
  return chunks.filter((c) => c.length > 10);
}

// Search knowledge base using simple keyword matching.
// Returns the most relevant chunks concatenated as context.
export async function searchKnowledge(query: string, clientId?: string): Promise<KnowledgeSearchResult> {
  if (!query || query.trim().length < 3) {
    return { found: false, context: "", confidenceScore: 0, chunksUsed: 0 };
  }

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;

  const chunks = await db.knowledgeChunk.findMany({
    where,
    take: 500, // limit for performance
    select: { id: true, content: true, metadata: true, sourceId: true },
  });

  if (chunks.length === 0) {
    return { found: false, context: "", confidenceScore: 0, chunksUsed: 0 };
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  // Score each chunk by counting keyword matches
  const scored = chunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      const matches = contentLower.split(word).length - 1;
      score += matches;
    }
    return { chunk, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top 3 chunks with score > 0
  const relevant = scored.filter((s) => s.score > 0).slice(0, 3);

  if (relevant.length === 0) {
    return { found: false, context: "", confidenceScore: 0, chunksUsed: 0 };
  }

  const context = relevant.map((s) => s.chunk.content).join("\n\n");
  const maxScore = relevant[0].score;
  const confidenceScore = Math.min(maxScore / (queryWords.length * 3), 1);

  let sourceName: string | undefined;
  try {
    const meta = JSON.parse(relevant[0].chunk.metadata || "{}");
    sourceName = meta.source_name;
  } catch { /* ignore */ }

  return {
    found: true,
    context,
    confidenceScore,
    sourceName,
    chunksUsed: relevant.length,
  };
}

// Extract text from a simple file content string (for manual/faq/policy).
// For PDF/Excel/CSV, the caller should extract text before calling this.
export function extractTextFromContent(content: string): string {
  return content.trim();
}
