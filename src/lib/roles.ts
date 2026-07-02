/**
 * PayFlow SMT — Role constants and permission helpers.
 */

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  OPERATOR: "operator",
  CLIENT_OWNER: "client_owner",
  CLIENT_OPERATOR: "client_operator",
  APPLICANT: "applicant",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleKey[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.OPERATOR,
  ROLES.CLIENT_OWNER,
  ROLES.CLIENT_OPERATOR,
  ROLES.APPLICANT,
];

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN]: "Administrador",
  [ROLES.OPERATOR]: "Operador de soporte",
  [ROLES.CLIENT_OWNER]: "Cliente (titular)",
  [ROLES.CLIENT_OPERATOR]: "Cliente (operador)",
  [ROLES.APPLICANT]: "Solicitante",
};

export const MODULES = {
  AUTOPILOT: "autopilot",
  PAYPHONE: "payphone",
  CATALOG: "catalog",
  AGENDA: "agenda",
  AI_AGENT: "ai_agent",
  FLOWS: "flows",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

export const ALL_MODULES: ModuleKey[] = [
  MODULES.AUTOPILOT,
  MODULES.PAYPHONE,
  MODULES.CATALOG,
  MODULES.AGENDA,
  MODULES.AI_AGENT,
  MODULES.FLOWS,
];

export const MODULE_LABELS: Record<string, string> = {
  [MODULES.AUTOPILOT]: "Autopilot (flujos automáticos)",
  [MODULES.PAYPHONE]: "PayPhone",
  [MODULES.CATALOG]: "Catálogo",
  [MODULES.AGENDA]: "Agenda",
  [MODULES.AI_AGENT]: "Agente IA",
  [MODULES.FLOWS]: "Flujos",
};

export const CLIENT_STATUS = {
  PENDING_REVIEW: "pending_review",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
} as const;

export const PROFILE_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
} as const;

export interface RoleContext {
  role: string;
  clientId?: string | null;
  clientStatus?: string | null;
  modules?: string[];
  memberPermissions?:
    | {
        canViewCatalog?: boolean;
        canViewAgenda?: boolean;
        canViewConversations?: boolean;
        canViewPayments?: boolean;
      }
    | null;
}

const ADMIN_ROLES: RoleKey[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const SUPER_ROLES: RoleKey[] = [ROLES.SUPER_ADMIN];
const INTERNAL_ROLES: RoleKey[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATOR];
const CLIENT_ROLES: RoleKey[] = [ROLES.CLIENT_OWNER, ROLES.CLIENT_OPERATOR];

export function isAdmin(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return ADMIN_ROLES.includes(ctx.role as RoleKey);
}

export function isSuperAdmin(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return SUPER_ROLES.includes(ctx.role as RoleKey);
}

export function isInternal(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return INTERNAL_ROLES.includes(ctx.role as RoleKey);
}

export function isClient(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return CLIENT_ROLES.includes(ctx.role as RoleKey);
}

export function isClientActive(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  if (ctx.role !== ROLES.CLIENT_OWNER && ctx.role !== ROLES.CLIENT_OPERATOR) return false;
  return ctx.clientStatus === CLIENT_STATUS.ACTIVE;
}

export function isApplicant(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  if (ctx.role === ROLES.APPLICANT) return true;
  if (
    (ctx.role === ROLES.CLIENT_OWNER || ctx.role === ROLES.CLIENT_OPERATOR) &&
    ctx.clientStatus !== CLIENT_STATUS.ACTIVE
  ) {
    return true;
  }
  return false;
}

export function getCurrentClientId(ctx: RoleContext | null | undefined): string | null {
  if (!ctx) return null;
  if (!isClient(ctx)) return null;
  return ctx.clientId ?? null;
}

export function hasModuleAccess(
  ctx: RoleContext | null | undefined,
  moduleKey: string
): boolean {
  if (!ctx) return false;
  if (isApplicant(ctx)) return false;
  if (isAdmin(ctx)) return true;
  if (ctx.role === ROLES.OPERATOR) {
    return [MODULES.CATALOG, MODULES.AGENDA].includes(moduleKey as ModuleKey);
  }
  if (isClient(ctx)) {
    if (!isClientActive(ctx)) return false;
    const contracted = ctx.modules ?? [];
    if (!contracted.includes(moduleKey)) return false;
    if (ctx.role === ROLES.CLIENT_OPERATOR && ctx.memberPermissions) {
      const mp = ctx.memberPermissions;
      switch (moduleKey) {
        case MODULES.CATALOG:
          return mp.canViewCatalog !== false;
        case MODULES.AGENDA:
          return mp.canViewAgenda !== false;
        case MODULES.PAYPHONE:
          return mp.canViewPayments === true;
        case MODULES.AI_AGENT:
          return mp.canViewConversations !== false;
        case MODULES.FLOWS:
          return mp.canViewConversations !== false;
        case MODULES.AUTOPILOT:
          return mp.canViewConversations !== false;
        default:
          return false;
      }
    }
    return true;
  }
  return false;
}

export function canSeeSecrets(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return SUPER_ROLES.includes(ctx.role as RoleKey) || ctx.role === ROLES.ADMIN;
}

export function canManageRoles(ctx: RoleContext | null | undefined): boolean {
  return isAdmin(ctx);
}

export function canSeeAudit(ctx: RoleContext | null | undefined): boolean {
  return isSuperAdmin(ctx);
}

export function canSeeGlobalPayPhone(ctx: RoleContext | null | undefined): boolean {
  return isSuperAdmin(ctx);
}

export function visibleNavKeys(ctx: RoleContext | null | undefined): string[] {
  if (!ctx) return [];
  if (isApplicant(ctx)) return ["application", "settings"];
  const keys: string[] = [];
  if (isAdmin(ctx) || ctx.role === ROLES.OPERATOR) {
    keys.push("dashboard", "executions", "subscriptions");
  } else if (isClient(ctx)) {
    keys.push("dashboard");
  } else {
    keys.push("dashboard");
  }
  if (isAdmin(ctx)) keys.push("clients");
  if (hasModuleAccess(ctx, MODULES.PAYPHONE) && canSeeSecrets(ctx)) keys.push("payphone");
  if (hasModuleAccess(ctx, MODULES.AI_AGENT)) keys.push("agent");
  if (hasModuleAccess(ctx, MODULES.CATALOG)) keys.push("catalog");
  if (hasModuleAccess(ctx, MODULES.AGENDA)) keys.push("agenda");
  if (isAdmin(ctx)) keys.push("legal");
  keys.push("settings");
  return keys;
}

/**
 * Returns an error message if the user CANNOT access the given nav key,
 * otherwise returns null (allowed).
 */
export function getAccessError(
  ctx: RoleContext | null | undefined,
  navKey: string
): string | null {
  if (!ctx) return "No autenticado.";
  if (!isApplicant(ctx) && navKey === "application") {
    return "Solo los solicitantes pueden acceder a esta sección.";
  }
  if (navKey === "settings") return null;
  const allowed = visibleNavKeys(ctx);
  if (!allowed.includes(navKey)) {
    return "Tu rol no tiene acceso a esta sección.";
  }
  return null;
}

export function roleBadgeLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "SUPER";
    case ROLES.ADMIN:
      return "ADMIN";
    case ROLES.OPERATOR:
      return "OPERADOR";
    case ROLES.CLIENT_OWNER:
    case ROLES.CLIENT_OPERATOR:
      return "CLIENTE";
    case ROLES.APPLICANT:
      return "SOLICITANTE";
    default:
      return null;
  }
}
