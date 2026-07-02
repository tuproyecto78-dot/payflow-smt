# Task 2-roles-rbac — full-stack-developer

## Task
Implement RBAC roles system for PayFlow SMT (Next.js 16 + Prisma/SQLite).

## Files Modified
- `src/lib/roles.ts` — added `getAccessError()` + `roleBadgeLabel()` helpers; updated `visibleNavKeys()` to include `clients` (admin only) and `settings` for applicants.
- `src/stores/auth-store.ts` — enriched `AuthUser` interface (id, email, name, role, clientId, clientStatus, modules, memberRole, memberPermissions, active); added `normalizeUser()` and `fetchMeWithTimeout()` (5s timeout); login/signup now re-fetch `/api/auth/me` for enriched profile.
- `src/app/api/auth/me/route.ts` — calls `getCurrentUserProfile()` and returns the full enriched user object; never throws.
- `src/app/api/auth/signup/route.ts` — creates User with `ROLES.APPLICANT`; also creates a Profile row (`role=applicant`, `status=pending`).
- `src/app/api/auth/login/route.ts` — trusts the DB role; defaults to `ROLES.APPLICANT` when blank.
- `src/components/common/sidebar.tsx` — renders only the nav items returned by `visibleNavKeys(ctx)`; shows role badge (SUPER/ADMIN/OPERADOR/CLIENTE/SOLICITANTE) next to user name with color-coded styling; adds `clients` and `legal` and `application` nav items.
- `src/components/common/app-shell.tsx` — gates the active nav with `getAccessError()`; renders `ApplicantView` for applicants; otherwise renders the full dashboard; uses a `lastUserKey` derived-state pattern (no setState-in-effect lint violation).
- `scripts/seed-admin.ts` — admin User role now `super_admin`; creates a Profile row; creates a demo `client_owner` (`cliente@demo.smt / cliente123`) with a ClientAccount that has every module enabled + a ClientMember row.

## Files Created
- `src/components/dashboard/applicant-view.tsx` — greeting "Hola, [name]"; "Cuenta sin suscripción activa" status card; CTA buttons linking to `/#section-precios`; subscription-request status; "Módulos bloqueados" grid showing all 6 modules as locked.
- `src/components/dashboard/clients-view.tsx` — admin view with two sections: (1) ClientAccount CRUD (create/edit/delete with modules switches + plan/status selectors), (2) profiles list with search and an "Asignar rol" dialog that calls `/api/admin/assign-role`.
- `src/components/dashboard/legal-view.tsx` — minimal dashboard view with links to public legal pages (`/privacy`, `/terms`, `/cookies`, `/data-request`).
- `src/app/api/admin/clients/route.ts` — `GET` (list clients w/ modules + member count) + `POST` (create client with module grants; auto-links an existing User/Profile by contactEmail as `client_owner`).
- `src/app/api/admin/clients/[id]/route.ts` — `GET` + `PATCH` (reconciles module grants via transaction) + `DELETE` (detaches profiles, deletes account).
- `src/app/api/admin/assign-role/route.ts` — `POST` updates both User and Profile rows; when downgrading to `applicant` clears `clientId` and resets `status=pending`.
- `src/app/api/admin/profiles/route.ts` — `GET` lists all profiles; resolves `clientAccount.businessName` via a separate `findMany` (no Prisma relation on Profile.clientId).
- `src/app/api/profile/route.ts` — `GET` returns profile + subscription requests + client account with modules; `PATCH` allows updating `fullName` only.

## Verification
- `bun run lint` → clean (0 errors, 0 warnings).
- `bunx tsc --noEmit` → no new errors introduced by this task (remaining errors are pre-existing in commercial-agent.ts, knowledge-import.ts, file-content-reader.ts, etc.).
- `bun run scripts/seed-admin.ts` → ran successfully:
  - Admin account updated to `super_admin`.
  - Admin Profile created.
  - Demo `cliente@demo.smt` user created.
  - Demo ClientAccount created with all 6 modules.
  - Demo ClientMember created as `client_owner`.
  - Demo client profile ready.

## Rules respected
- Did NOT touch PayPhone (PAYPHONE_ENV=disabled unchanged).
- Did NOT touch legal pages (`/privacy`, `/terms`, `/cookies`, `/data-request`).
- Did NOT touch knowledge IA module.
- Did NOT touch routing (`app/page.tsx`, `layout.tsx`).
- Used existing shadcn/ui components (Card, Dialog, Select, Switch, Badge, Input, Label, Button).
- Used `import { db } from "@/lib/db"`, `getSession`, `getCurrentUserProfile`, `requireAdmin`, `denyResponse` as specified.
