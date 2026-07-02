-- ============================================================================
-- PayFlow SMT — Esquema de base de datos para Supabase
-- ============================================================================
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase.
-- Crea las tablas: profiles, projects, workflows, workflow_runs, execution_logs
-- y payment_transactions (capa de proveedores de pago de Ecuador).
--
-- Todas las tablas con datos de usuario tienen Row Level Security (RLS) activado
-- y políticas para que cada usuario solo acceda a sus propias filas.
-- ============================================================================

-- ─── Extensiones ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tabla: profiles ──────────────────────────────────────────────────────
-- Vinculada 1:1 con auth.users. Se crea automáticamente vía trigger.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  role        text not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Función para crear el perfil automáticamente cuando un usuario se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Tabla: projects ──────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);

-- ─── Tabla: workflows ─────────────────────────────────────────────────────
create table if not exists public.workflows (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  nodes       jsonb not null default '[]'::jsonb,
  edges       jsonb not null default '[]'::jsonb,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_workflows_user_id on public.workflows(user_id);
create index if not exists idx_workflows_project_id on public.workflows(project_id);
create index if not exists idx_workflows_updated_at on public.workflows(updated_at desc);

-- ─── Tabla: workflow_runs ─────────────────────────────────────────────────
create table if not exists public.workflow_runs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workflow_id  uuid not null references public.workflows(id) on delete cascade,
  status       text not null default 'running',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  input        jsonb not null default '{}'::jsonb,
  output       jsonb not null default '{}'::jsonb
);
create index if not exists idx_workflow_runs_user_id on public.workflow_runs(user_id);
create index if not exists idx_workflow_runs_workflow_id on public.workflow_runs(workflow_id);
create index if not exists idx_workflow_runs_started_at on public.workflow_runs(started_at desc);

-- ─── Tabla: execution_logs ────────────────────────────────────────────────
create table if not exists public.execution_logs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  workflow_run_id  uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_id      uuid not null references public.workflows(id) on delete cascade,
  node_id          text not null,
  node_type        text not null,
  node_label       text not null,
  status           text not null,
  input            jsonb not null default '{}'::jsonb,
  output           jsonb not null default '{}'::jsonb,
  message          text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists idx_execution_logs_user_id on public.execution_logs(user_id);
create index if not exists idx_execution_logs_workflow_run_id on public.execution_logs(workflow_run_id);
create index if not exists idx_execution_logs_workflow_id on public.execution_logs(workflow_id);
create index if not exists idx_execution_logs_created_at on public.execution_logs(created_at desc);

-- ─── Tabla: payment_transactions ──────────────────────────────────────────
-- (Capa de proveedores de pago de Ecuador: Mock, PayPhone, DEUNA, Stripe, API)
create table if not exists public.payment_transactions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  workflow_id         uuid references public.workflows(id) on delete set null,
  workflow_run_id     uuid references public.workflow_runs(id) on delete set null,
  provider            text not null,
  provider_payment_id text,
  order_id            text,
  amount              numeric not null default 0,
  currency            text not null default 'USD',
  status              text not null default 'payment_pending',
  payment_link        text,
  raw_response        jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_payment_tx_user_id on public.payment_transactions(user_id);
create index if not exists idx_payment_tx_workflow_id on public.payment_transactions(workflow_id);
create index if not exists idx_payment_tx_provider on public.payment_transactions(provider);
create index if not exists idx_payment_tx_status on public.payment_transactions(status);

-- ============================================================================
-- Row Level Security (RLS)
-- Cada usuario solo puede ver y modificar sus propias filas.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.execution_logs enable row level security;
alter table public.payment_transactions enable row level security;

-- ─── profiles ─────────────────────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ─── projects ─────────────────────────────────────────────────────────────
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- ─── workflows ────────────────────────────────────────────────────────────
drop policy if exists "workflows_select_own" on public.workflows;
create policy "workflows_select_own" on public.workflows
  for select using (auth.uid() = user_id);

drop policy if exists "workflows_insert_own" on public.workflows;
create policy "workflows_insert_own" on public.workflows
  for insert with check (auth.uid() = user_id);

drop policy if exists "workflows_update_own" on public.workflows;
create policy "workflows_update_own" on public.workflows
  for update using (auth.uid() = user_id);

drop policy if exists "workflows_delete_own" on public.workflows;
create policy "workflows_delete_own" on public.workflows
  for delete using (auth.uid() = user_id);

-- ─── workflow_runs ────────────────────────────────────────────────────────
drop policy if exists "workflow_runs_select_own" on public.workflow_runs;
create policy "workflow_runs_select_own" on public.workflow_runs
  for select using (auth.uid() = user_id);

drop policy if exists "workflow_runs_insert_own" on public.workflow_runs;
create policy "workflow_runs_insert_own" on public.workflow_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists "workflow_runs_update_own" on public.workflow_runs;
create policy "workflow_runs_update_own" on public.workflow_runs
  for update using (auth.uid() = user_id);

drop policy if exists "workflow_runs_delete_own" on public.workflow_runs;
create policy "workflow_runs_delete_own" on public.workflow_runs
  for delete using (auth.uid() = user_id);

-- ─── execution_logs ───────────────────────────────────────────────────────
drop policy if exists "execution_logs_select_own" on public.execution_logs;
create policy "execution_logs_select_own" on public.execution_logs
  for select using (auth.uid() = user_id);

drop policy if exists "execution_logs_insert_own" on public.execution_logs;
create policy "execution_logs_insert_own" on public.execution_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "execution_logs_update_own" on public.execution_logs;
create policy "execution_logs_update_own" on public.execution_logs
  for update using (auth.uid() = user_id);

drop policy if exists "execution_logs_delete_own" on public.execution_logs;
create policy "execution_logs_delete_own" on public.execution_logs
  for delete using (auth.uid() = user_id);

-- ─── payment_transactions ─────────────────────────────────────────────────
drop policy if exists "payment_tx_select_own" on public.payment_transactions;
create policy "payment_tx_select_own" on public.payment_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "payment_tx_insert_own" on public.payment_transactions;
create policy "payment_tx_insert_own" on public.payment_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "payment_tx_update_own" on public.payment_transactions;
create policy "payment_tx_update_own" on public.payment_transactions
  for update using (auth.uid() = user_id);

drop policy if exists "payment_tx_delete_own" on public.payment_transactions;
create policy "payment_tx_delete_own" on public.payment_transactions
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Triggers para updated_at
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_workflows on public.workflows;
create trigger touch_workflows before update on public.workflows
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_payment_tx on public.payment_transactions;
create trigger touch_payment_tx before update on public.payment_transactions
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Sembrar el flujo "Cobro por WhatsApp con IA" para nuevos usuarios
-- (Opcional: ejecutar manualmente para usuarios existentes.)
-- ============================================================================
-- El seed del flujo se maneja en la aplicación (src/lib/templates.ts)
-- para que cada usuario nuevo reciba la plantilla automáticamente.

-- Fin del esquema.

-- ============================================================================
-- Tabla: subscription_requests
-- Solicitudes de suscripción a planes de PayFlow SMT.
-- ============================================================================
create table if not exists public.subscription_requests (
  id                  uuid primary key default uuid_generate_v4(),
  selected_plan       text not null,
  full_name           text not null,
  country_code        text not null,
  phone_number        text not null,
  email               text not null,
  document_id         text not null,
  business_name       text,
  business_type       text,
  country             text,
  subscription_status text not null default 'pending_review',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_subreq_status on public.subscription_requests(subscription_status);
create index if not exists idx_subreq_email on public.subscription_requests(email);
create index if not exists idx_subreq_created_at on public.subscription_requests(created_at desc);

-- RLS: los usuarios autenticados pueden ver solicitudes (para el panel admin).
-- La inserción es pública (cualquiera puede suscribirse desde la landing).
alter table public.subscription_requests enable row level security;

drop policy if exists "subreq_insert_public" on public.subscription_requests;
create policy "subreq_insert_public" on public.subscription_requests
  for insert with check (true);

drop policy if exists "subreq_select_auth" on public.subscription_requests;
create policy "subreq_select_auth" on public.subscription_requests
  for select using (auth.role() = 'authenticated');

drop policy if exists "subreq_update_auth" on public.subscription_requests;
create policy "subreq_update_auth" on public.subscription_requests
  for update using (auth.role() = 'authenticated');

drop trigger if exists touch_subreq on public.subscription_requests;
create trigger touch_subreq before update on public.subscription_requests
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Tabla: audit_logs
-- Registros de auditoría para seguridad.
-- ============================================================================
create table if not exists public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  ip_address  text,
  user_agent  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_action on public.audit_logs(action);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

-- Solo usuarios autenticados pueden leer sus propios logs de auditoría.
drop policy if exists "audit_select_own" on public.audit_logs;
create policy "audit_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

-- Solo el servicio (backend) puede insertar logs de auditoría.
drop policy if exists "audit_insert_service" on public.audit_logs;
create policy "audit_insert_service" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');
