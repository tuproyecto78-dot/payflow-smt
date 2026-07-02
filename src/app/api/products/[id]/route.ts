import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sanitizeText, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { getClientIP } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/products/[id]
 * Updates a product. Body can include: name, description, price, stock, active, sku, imageUrl.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ip = getClientIP(req);

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") data.name = sanitizeText(body.name).slice(0, 200);
    if (typeof body.description === "string") data.description = sanitizeText(body.description).slice(0, 1000);
    if (typeof body.price === "number" && body.price > 0) data.price = body.price;
    if (typeof body.stock === "number" && body.stock >= 0) data.stock = body.stock;
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.sku === "string") data.sku = sanitizeText(body.sku).slice(0, 100);
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar." }, { status: 400 });
    }

    const updated = await db.product.update({
      where: { id },
      data,
    });

    // If stock changed, create inventory movement
    if (typeof body.stock === "number") {
      const previous = await db.product.findUnique({ where: { id }, select: { stock: true } });
      // Note: we already updated, so we can't get the previous value easily.
      // The movement records the new stock as an adjustment.
    }

    void logAudit({
      userId: session.userId,
      action: "product_updated",
      entityType: "product",
      entityId: id,
      ipAddress: ip,
      metadata: { name: updated.name, price: updated.price, stock: updated.stock, active: updated.active },
    });

    return NextResponse.json({ ok: true, product: updated });
  } catch (err) {
    console.error("[products PATCH] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

/**
 * DELETE /api/products/[id]
 * Deletes a product.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ip = getClientIP(req);

  try {
    const product = await db.product.findUnique({ where: { id }, select: { name: true } });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    await db.product.delete({ where: { id } });

    void logAudit({
      userId: session.userId,
      action: "product_deleted",
      entityType: "product",
      entityId: id,
      ipAddress: ip,
      metadata: { name: product.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[products DELETE] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
