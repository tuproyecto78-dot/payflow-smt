import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, denyResponse } from "@/lib/auth-server";
import { ALL_ROLES, ROLES } from "@/lib/roles";

/**
 * POST /api/admin/assign-role
 * Assigns a role to a user by email. Updates both User and Profile rows.
 *
 * Body: { email, role }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();

    if (!email || !role) {
      return NextResponse.json(
        { error: "email and role are required." },
        { status: 400 }
      );
    }
    if (!ALL_ROLES.includes(role as never)) {
      return NextResponse.json(
        { error: `Rol inválido. Roles válidos: ${ALL_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "No existe un usuario con ese email." },
        { status: 404 }
      );
    }

    // When downgrading to applicant, clear client linkage.
    const clearClient = role === ROLES.APPLICANT;

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { role },
      }),
      db.profile.updateMany({
        where: { userId: user.id },
        data: {
          role,
          ...(clearClient
            ? { clientId: null, status: "pending" }
            : {}),
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role },
    });
  } catch (err) {
    console.error("[admin/assign-role]", err);
    return denyResponse(err);
  }
}

export const dynamic = "force-dynamic";
