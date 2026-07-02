import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, denyResponse } from "@/lib/auth-server";

/**
 * GET /api/admin/profiles
 * Returns all profiles with role, status, and the linked client business name.
 * Admin-only.
 */
export async function GET() {
  try {
    await requireAdmin();
    const profiles = await db.profile.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Resolve client business names in a single query (Profile.clientId is a
    // plain String? foreign key — there is no Prisma relation to follow).
    const clientIds = Array.from(
      new Set(profiles.map((p) => p.clientId).filter((v): v is string => !!v))
    );
    const clients =
      clientIds.length > 0
        ? await db.clientAccount.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, businessName: true },
          })
        : [];
    const clientById = new Map(clients.map((c) => [c.id, c.businessName]));

    const result = profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      status: p.status,
      clientId: p.clientId,
      clientAccount: p.clientId
        ? { businessName: clientById.get(p.clientId) ?? null }
        : null,
      createdAt: p.createdAt,
    }));
    return NextResponse.json({ profiles: result });
  } catch (err) {
    return denyResponse(err);
  }
}

export const dynamic = "force-dynamic";
