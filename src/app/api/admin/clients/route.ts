import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, denyResponse } from "@/lib/auth-server";
import {
  ALL_MODULES,
  CLIENT_STATUS,
  type ModuleKey,
} from "@/lib/roles";

/**
 * GET /api/admin/clients
 * Returns the list of client accounts with their contracted modules and
 * member count. Admin-only.
 */
export async function GET() {
  try {
    await requireAdmin();
    const clients = await db.clientAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        moduleGrants: { where: { enabled: true } },
        members: { select: { id: true } },
      },
    });
    const now = new Date();
    const result = clients.map((c) => ({
      id: c.id,
      businessName: c.businessName,
      contactEmail: c.contactEmail,
      plan: c.plan,
      status: c.status,
      modules: c.moduleGrants
        .filter((g) => !g.expiresAt || g.expiresAt > now)
        .map((g) => g.moduleKey),
      memberCount: c.members.length,
      createdAt: c.createdAt,
    }));
    return NextResponse.json({ clients: result });
  } catch (err) {
    return denyResponse(err);
  }
}

/**
 * POST /api/admin/clients
 * Creates a new client account with the requested module grants.
 * Body: { businessName, contactEmail, plan?, status?, modules: string[] }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const businessName = String(body.businessName || "").trim();
    const contactEmail = String(body.contactEmail || "").trim().toLowerCase();
    const plan = String(body.plan || "trimestral");
    const status = String(body.status || CLIENT_STATUS.PENDING_REVIEW);
    const rawModules = Array.isArray(body.modules) ? body.modules : [];

    if (!businessName || !contactEmail) {
      return NextResponse.json(
        { error: "businessName and contactEmail are required." },
        { status: 400 }
      );
    }
    const modules = rawModules.filter((m): m is ModuleKey =>
      ALL_MODULES.includes(m as ModuleKey)
    );

    const client = await db.clientAccount.create({
      data: {
        businessName,
        contactEmail,
        plan,
        status,
        modulesJson: JSON.stringify(modules),
        moduleGrants: {
          create: modules.map((moduleKey) => ({ moduleKey, enabled: true })),
        },
      },
      include: { moduleGrants: true },
    });

    // Try to link an existing profile/user with the same email as a client_owner.
    try {
      const user = await db.user.findUnique({ where: { email: contactEmail } });
      if (user) {
        await Promise.all([
          db.clientMember.create({
            data: {
              clientId: client.id,
              userId: user.id,
              email: user.email,
              fullName: user.name,
              role: "client_owner",
              canViewCatalog: true,
              canViewAgenda: true,
              canViewConversations: true,
              canViewPayments: modules.includes("payphone"),
            },
          }),
          db.profile.updateMany({
            where: { userId: user.id },
            data: {
              role: "client_owner",
              clientId: client.id,
              status: status === CLIENT_STATUS.ACTIVE ? "active" : "pending",
            },
          }),
        ]);
        await db.user.update({
          where: { id: user.id },
          data: { role: "client_owner" },
        });
      }
    } catch (linkErr) {
      console.error("[admin/clients POST] link user failed", linkErr);
    }

    return NextResponse.json(
      {
        client: {
          id: client.id,
          businessName: client.businessName,
          contactEmail: client.contactEmail,
          plan: client.plan,
          status: client.status,
          modules: client.moduleGrants.map((g) => g.moduleKey),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin/clients POST]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Ya existe un cliente con esos datos." },
        { status: 409 }
      );
    }
    return denyResponse(err);
  }
}

// Hint to ensure this route is always dynamic.
export const dynamic = "force-dynamic";
