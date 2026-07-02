import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIP, sanitizeText, isValidAmount, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const where: Record<string, unknown> = {};
  if (searchParams.get("clientId")) where.clientId = searchParams.get("clientId");
  if (searchParams.get("active") === "true") where.active = true;
  const products = await db.product.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIP(req);
  if (!rateLimit(`products:${ip}`, 20, 60_000)) return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  try {
    const body = await req.json();
    const name = sanitizeText(body.name).slice(0, 200);
    if (!name) return NextResponse.json({ error: "name es obligatorio." }, { status: 400 });
    if (!isValidAmount(body.price)) return NextResponse.json({ error: "price debe ser mayor a 0." }, { status: 400 });
    const product = await db.product.create({
      data: {
        name,
        description: body.description ? sanitizeText(body.description).slice(0, 1000) : null,
        price: Number(body.price),
        currency: body.currency || "USD",
        stock: typeof body.stock === "number" ? body.stock : 0,
        categoryId: body.categoryId || null,
        imageUrl: body.imageUrl || null,
        sku: body.sku || null,
        clientId: body.clientId || null,
        active: body.active !== false,
      },
    });
    void logAudit({ userId: session.userId, action: "product_created", entityType: "product", entityId: product.id, ipAddress: ip, metadata: { name, price: product.price } });
    return NextResponse.json({ ok: true, product_id: product.id });
  } catch (err) {
    console.error("[products POST] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
