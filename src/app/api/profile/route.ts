import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserProfile, denyResponse } from "@/lib/auth-server";
import { ROLES } from "@/lib/roles";

/**
 * GET /api/profile
 * Returns the current user's profile, subscription requests, and client
 * account (with contracted modules).
 */
export async function GET() {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    // Latest subscription request for this email (if any).
    const subscriptionRequests = await db.subscriptionRequest.findMany({
      where: { email: profile.email },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        selectedPlan: true,
        selectedPlanLabel: true,
        businessName: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    });

    let clientAccount: {
      id: string;
      businessName: string;
      status: string;
      modules: string[];
    } | null = null;

    if (profile.clientId) {
      const client = await db.clientAccount.findUnique({
        where: { id: profile.clientId },
        include: { moduleGrants: { where: { enabled: true } } },
      });
      if (client) {
        const now = new Date();
        clientAccount = {
          id: client.id,
          businessName: client.businessName,
          status: client.status,
          modules: client.moduleGrants
            .filter((g) => !g.expiresAt || g.expiresAt > now)
            .map((g) => g.moduleKey),
        };
      }
    }

    return NextResponse.json({
      profile: {
        userId: profile.userId,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        status:
          profile.role === ROLES.SUPER_ADMIN ||
          profile.role === ROLES.ADMIN ||
          profile.role === ROLES.OPERATOR
            ? "active"
            : (profile.clientStatus ?? "pending"),
        clientId: profile.clientId ?? null,
        clientStatus: profile.clientStatus ?? null,
        modules: profile.modules ?? [],
        memberRole: profile.memberRole ?? null,
        memberPermissions: profile.memberPermissions ?? null,
      },
      subscriptionRequests,
      clientAccount,
    });
  } catch (err) {
    return denyResponse(err);
  }
}

/**
 * PATCH /api/profile
 * Allows the current user to update only their fullName.
 */
export async function PATCH(req: Request) {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : null;
    if (!fullName) {
      return NextResponse.json(
        { error: "fullName es obligatorio." },
        { status: 400 }
      );
    }

    if (profile.profileId) {
      await db.profile.update({
        where: { id: profile.profileId },
        data: { fullName },
      });
    } else {
      // Lazy-create the profile row if missing.
      await db.profile.create({
        data: {
          userId: profile.userId,
          email: profile.email,
          fullName,
          role: profile.role,
        },
      });
    }
    await db.user.update({
      where: { id: profile.userId },
      data: { name: fullName },
    });

    return NextResponse.json({ ok: true, fullName });
  } catch (err) {
    return denyResponse(err);
  }
}

export const dynamic = "force-dynamic";
