import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, denyResponse } from "@/lib/auth-server";
import {
  ALL_MODULES,
  CLIENT_STATUS,
  type ModuleKey,
} from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/clients/[id]
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const client = await db.clientAccount.findUnique({
      where: { id },
      include: {
        moduleGrants: true,
        members: { select: { id: true, email: true, fullName: true, role: true } },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      client: {
        id: client.id,
        businessName: client.businessName,
        contactEmail: client.contactEmail,
        plan: client.plan,
        status: client.status,
        modules: client.moduleGrants
          .filter((g) => g.enabled)
          .map((g) => g.moduleKey),
        members: client.members,
        createdAt: client.createdAt,
      },
    });
  } catch (err) {
    return denyResponse(err);
  }
}

/**
 * PATCH /api/admin/clients/[id]
 * Updates basic fields and reconciles module grants.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.clientAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const businessName =
      typeof body.businessName === "string" ? body.businessName.trim() : undefined;
    const contactEmail =
      typeof body.contactEmail === "string"
        ? body.contactEmail.trim().toLowerCase()
        : undefined;
    const plan = typeof body.plan === "string" ? body.plan : undefined;
    const status = typeof body.status === "string" ? body.status : undefined;

    if (status && !Object.values(CLIENT_STATUS).includes(status as never)) {
      return NextResponse.json({ error: "status inválido." }, { status: 400 });
    }

    const rawModules = Array.isArray(body.modules) ? body.modules : null;
    const modules =
      rawModules != null
        ? rawModules.filter((m): m is ModuleKey =>
            ALL_MODULES.includes(m as ModuleKey)
          )
        : null;

    await db.$transaction(async (tx) => {
      await tx.clientAccount.update({
        where: { id },
        data: {
          ...(businessName ? { businessName } : {}),
          ...(contactEmail ? { contactEmail } : {}),
          ...(plan ? { plan } : {}),
          ...(status ? { status } : {}),
          ...(modules
            ? { modulesJson: JSON.stringify(modules) }
            : {}),
        },
      });

      if (modules) {
        // Drop existing grants and recreate the requested set.
        await tx.clientModule.deleteMany({ where: { clientId: id } });
        if (modules.length > 0) {
          await tx.clientModule.createMany({
            data: modules.map((moduleKey) => ({
              clientId: id,
              moduleKey,
              enabled: true,
            })),
          }
          );
        }
      }

      // If the client is now active, also mark its owner members + profile active.
      if (status === CLIENT_STATUS.ACTIVE) {
        const owners = await tx.clientMember.findMany({
          where: { clientId: id, role: "client_owner" },
          select: { userId: true },
        });
        if (owners.length > 0) {
          await tx.profile.updateMany({
            where: { userId: { in: owners.map((m) => m.userId) } },
            data: { status: "active" },
          });
        }
      }
    });

    const updated = await db.clientAccount.findUnique({
      where: { id },
      include: { moduleGrants: { where: { enabled: true } } },
    });

    return NextResponse.json({
      client: {
        id: updated!.id,
        businessName: updated!.businessName,
        contactEmail: updated!.contactEmail,
        plan: updated!.plan,
        status: updated!.status,
        modules: updated!.moduleGrants.map((g) => g.moduleKey),
      },
    });
  } catch (err) {
    console.error("[admin/clients PATCH]", err);
    return denyResponse(err);
  }
}

/**
 * DELETE /api/admin/clients/[id]
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Detach profiles first to avoid orphan clientId references.
    await db.profile.updateMany({
      where: { clientId: id },
      data: { clientId: null, status: "cancelled", role: "applicant" },
    });

    await db.clientAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/clients DELETE]", err);
    return denyResponse(err);
  }
}

export const dynamic = "force-dynamic";
