/**
 * PayFlow SMT — Server-side auth helpers (RBAC layer).
 */
import "server-only";

import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import {
  type RoleContext,
  ROLES,
  CLIENT_STATUS,
  PROFILE_STATUS,
  type ModuleKey,
} from "@/lib/roles";

export interface UserProfile extends RoleContext {
  userId: string;
  email: string;
  fullName: string | null;
  profileId: string | null;
  memberRole: string | null;
  active: boolean;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const session = await getSession();
  if (!session) return null;
  return loadProfileFromSession(session);
}

export async function loadProfileFromSession(
  session: SessionPayload
): Promise<UserProfile | null> {
  const userId = session.userId;
  if (!userId) return null;

  try {
    let profile = await db.profile.findUnique({ where: { userId } });
    if (!profile) {
      try {
        profile = await db.profile.create({
          data: {
            userId,
            email: session.email,
            fullName: session.name ?? null,
            role: (session.role as string) || ROLES.APPLICANT,
            status: PROFILE_STATUS.PENDING,
          },
        });
      } catch {
        profile = await db.profile.findUnique({ where: { userId } });
      }
    }

    if (!profile) {
      return fallbackProfile(session);
    }

    const role = profile.role;
    const clientId = profile.clientId;

    let clientStatus: string | null = null;
    let modules: string[] = [];
    let memberRole: string | null = null;
    let memberPermissions: RoleContext["memberPermissions"] = null;

    if (clientId) {
      try {
        const client = await db.clientAccount.findUnique({
          where: { id: clientId },
          include: {
            moduleGrants: { where: { enabled: true } },
            members: { where: { userId } },
          },
        });
        if (client) {
          clientStatus = client.status;
          const now = new Date();
          modules = client.moduleGrants
            .filter((g) => !g.expiresAt || g.expiresAt > now)
            .map((g) => g.moduleKey);

          const member = client.members[0];
          if (member) {
            memberRole = member.role;
            memberPermissions = {
              canViewCatalog: member.canViewCatalog,
              canViewAgenda: member.canViewAgenda,
              canViewConversations: member.canViewConversations,
              canViewPayments: member.canViewPayments,
            };
          }
        }
      } catch {
        // Client lookup failed — treat as no client.
      }
    }

    const active =
      role === ROLES.SUPER_ADMIN ||
      role === ROLES.ADMIN ||
      role === ROLES.OPERATOR ||
      ((role === ROLES.CLIENT_OWNER || role === ROLES.CLIENT_OPERATOR) &&
        clientStatus === CLIENT_STATUS.ACTIVE);

    return {
      userId,
      email: profile.email || session.email,
      fullName: profile.fullName,
      profileId: profile.id,
      role,
      clientId,
      clientStatus,
      modules,
      memberPermissions,
      memberRole,
      active,
    };
  } catch (err) {
    console.error("[auth-server] loadProfileFromSession fell back:", err);
    return fallbackProfile(session);
  }
}

function fallbackProfile(session: SessionPayload): UserProfile {
  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.PAYFLOW_PREVIEW_MODE === "true";
  const fallbackRole = isDev ? ROLES.ADMIN : ROLES.APPLICANT;
  const role = (session.role as string) || fallbackRole;
  return {
    userId: session.userId,
    email: session.email,
    fullName: session.name ?? null,
    profileId: null,
    role,
    clientId: null,
    clientStatus: null,
    modules: [],
    memberPermissions: null,
    memberRole: null,
    active: isDev ? true : role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN,
  };
}

export async function getCurrentUserRole(): Promise<string | null> {
  const p = await getCurrentUserProfile();
  return p?.role ?? null;
}

export async function getCurrentClientId(): Promise<string | null> {
  const p = await getCurrentUserProfile();
  if (!p) return null;
  if (p.role !== ROLES.CLIENT_OWNER && p.role !== ROLES.CLIENT_OPERATOR) return null;
  return p.clientId ?? null;
}

export async function isClientActive(): Promise<boolean> {
  const p = await getCurrentUserProfile();
  if (!p) return false;
  return p.active && (p.role === ROLES.CLIENT_OWNER || p.role === ROLES.CLIENT_OPERATOR);
}

export async function requireModuleAccess(
  moduleKey: ModuleKey | string
): Promise<UserProfile> {
  const { hasModuleAccess } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  if (!hasModuleAccess(profile, moduleKey)) {
    throw new AccessDeniedError(
      `Tu rol no tiene acceso al módulo "${moduleKey}".`,
      403
    );
  }
  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const { isAdmin } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  if (!isAdmin(profile)) {
    throw new AccessDeniedError("Se requiere rol de administrador.", 403);
  }
  return profile;
}

export async function requireSuperAdmin(): Promise<UserProfile> {
  const { isSuperAdmin } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  if (!isSuperAdmin(profile)) {
    throw new AccessDeniedError("Se requiere rol de super administrador.", 403);
  }
  return profile;
}

export async function requireInternal(): Promise<UserProfile> {
  const { isInternal } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  if (!isInternal(profile)) {
    throw new AccessDeniedError("Acceso restringido a personal interno.", 403);
  }
  return profile;
}

export async function requireActiveClient(): Promise<UserProfile> {
  const { isClientActive } = await import("@/lib/roles");
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  if (!isClientActive(profile)) {
    throw new AccessDeniedError(
      "Tu suscripción no está activa. No puedes acceder a este módulo.",
      403
    );
  }
  return profile;
}

export async function requireClientOwnerOrAdmin(
  clientId: string
): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new AccessDeniedError("Not authenticated", 401);
  }
  const { isAdmin } = await import("@/lib/roles");
  if (isAdmin(profile)) return profile;
  if (profile.role !== ROLES.CLIENT_OWNER) {
    throw new AccessDeniedError("Solo el titular del cliente puede hacer esto.", 403);
  }
  if (profile.clientId !== clientId) {
    throw new AccessDeniedError("No tienes permiso sobre este cliente.", 403);
  }
  return profile;
}

export class AccessDeniedError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AccessDeniedError";
    this.statusCode = statusCode;
  }
}

export function denyResponse(err: unknown) {
  if (err instanceof AccessDeniedError) {
    return Response.json({ error: err.message }, { status: err.statusCode });
  }
  console.error("[auth-server] unexpected error", err);
  return Response.json(
    { error: "Internal server error." },
    { status: 500 }
  );
}
