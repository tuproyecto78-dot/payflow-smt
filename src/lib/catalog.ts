// Catálogo inteligente para PayFlow SMT.
// Stock visibility rules: internal stock is never shown to the client.
import { db } from "./db";

export interface ProductSearchResult {
  found: boolean;
  product_id: string | null;
  product_name: string | null;
  description: string | null;
  public_description: string | null;
  price: number;
  currency: string;
  stock: number;
  stock_status: string;
  stock_visibility: string;
  model: string | null;
  color: string | null;
  variants: string | null;
  features: string | null;
  public_promotion: string | null;
  category: string | null;
  image_url: string | null;
}

export interface ReservationResult {
  reservation_status: "reserved" | "out_of_stock" | "error";
  amount: number;
  currency: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
}

export async function searchProduct(query: string, clientId?: string): Promise<ProductSearchResult> {
  if (!query || query.trim().length < 2) return emptyProductResult();

  const where: Record<string, unknown> = { active: true };
  if (clientId) where.clientId = clientId;

  const products = await db.product.findMany({
    where, take: 100,
    select: { id: true, name: true, description: true, publicDescription: true, price: true, currency: true, stock: true, stockStatus: true, stockVisibility: true, model: true, color: true, variants: true, features: true, publicPromotion: true, imageUrl: true, sku: true, categoryId: true },
  });

  if (products.length === 0) return emptyProductResult();

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  const scored = products.map((p) => {
    const nameLower = p.name.toLowerCase();
    const descLower = (p.description || "").toLowerCase();
    let score = 0;
    for (const word of queryWords) { if (nameLower.includes(word)) score += 3; if (descLower.includes(word)) score += 1; }
    return { product: p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0);
  if (!best) return emptyProductResult();

  let categoryName: string | null = null;
  if (best.product.categoryId) {
    const cat = await db.productCategory.findUnique({ where: { id: best.product.categoryId }, select: { name: true } });
    categoryName = cat?.name || null;
  }

  return {
    found: true,
    product_id: best.product.id,
    product_name: best.product.name,
    description: best.product.description,
    public_description: best.product.publicDescription,
    price: best.product.price,
    currency: best.product.currency,
    stock: best.product.stock,
    stock_status: best.product.stockStatus || "available",
    stock_visibility: best.product.stockVisibility || "hidden",
    model: best.product.model,
    color: best.product.color,
    variants: best.product.variants,
    features: best.product.features,
    public_promotion: best.product.publicPromotion,
    category: categoryName,
    image_url: best.product.imageUrl,
  };
}

export function buildPublicAvailabilityMessage(result: ProductSearchResult): string {
  const status = result.stock_status;
  if (status === "available" && result.stock > 0) return "Sí, está disponible.";
  if (status === "unavailable" || result.stock === 0) return "Por ahora no está disponible. Puedo mostrarte una alternativa similar.";
  if (status === "low_stock") return "Tenemos disponibilidad limitada. Te recomiendo confirmar pronto.";
  if (status === "unknown") return "Déjame confirmar disponibilidad con un asesor.";
  return "Sí, está disponible.";
}

export function shouldHideStock(result: ProductSearchResult): boolean {
  return result.stock_visibility === "hidden" || result.stock_visibility === "admin_only";
}

export async function reserveProduct(productId: string, quantity: number = 1, clientId?: string): Promise<ReservationResult> {
  try {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, currency: true, stock: true, internalStock: true, active: true, stockStatus: true },
    });
    if (!product || !product.active) return { reservation_status: "error", amount: 0, currency: "USD", product_id: productId, product_name: null, quantity };
    const availableStock = product.internalStock || product.stock;
    if (availableStock < quantity) return { reservation_status: "out_of_stock", amount: 0, currency: product.currency, product_id: product.id, product_name: product.name, quantity };
    await db.inventoryMovement.create({ data: { productId: product.id, clientId: clientId || null, type: "reservation", quantity, reason: "Reserva por Agente Comercial IA" } });
    const newStock = Math.max(0, product.stock - quantity);
    const newInternal = Math.max(0, availableStock - quantity);
    await db.product.update({ where: { id: product.id }, data: { stock: newStock, internalStock: newInternal, stockStatus: newInternal <= (product.internalStock || 0) * 0.2 ? "low_stock" : "available" } });
    return { reservation_status: "reserved", amount: product.price * quantity, currency: product.currency, product_id: product.id, product_name: product.name, quantity };
  } catch (err) {
    console.error("[catalog] reserveProduct error:", err);
    return { reservation_status: "error", amount: 0, currency: "USD", product_id: productId, product_name: null, quantity };
  }
}

function emptyProductResult(): ProductSearchResult {
  return { found: false, product_id: null, product_name: null, description: null, public_description: null, price: 0, currency: "USD", stock: 0, stock_status: "unknown", stock_visibility: "hidden", model: null, color: null, variants: null, features: null, public_promotion: null, category: null, image_url: null };
}
