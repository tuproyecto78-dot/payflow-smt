-- PayFlow SMT — Knowledge Autopilot Schema (Supabase / PostgreSQL)
-- Migration: create knowledge tables with Row Level Security (RLS)
--
-- Tables created:
--   knowledge_sources
--   knowledge_chunks
--   knowledge_extractions
--   knowledge_embeddings
--   agent_knowledge_links
--
-- RLS Rules:
--   - Admin/super_admin can CRUD all knowledge
--   - Client owners can CRUD their own client's knowledge
--   - Client operators can SELECT (read) but not write
--   - Public/anon users have NO access

-- ─── knowledge_sources ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id           TEXT,
  workflow_id         TEXT,
  business_profile_id TEXT,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'manual',
  file_url            TEXT,
  original_file_name  TEXT,
  mime_type           TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  processing_error    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ks_client_id     ON knowledge_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_ks_workflow_id   ON knowledge_sources(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ks_business_id   ON knowledge_sources(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_ks_status        ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_ks_type          ON knowledge_sources(type);

-- ─── knowledge_chunks ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  knowledge_source_id  TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  client_id            TEXT,
  workflow_id          TEXT,
  content              TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'unknown',
  metadata             JSONB NOT NULL DEFAULT '{}',
  chunk_index          INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_source_id   ON knowledge_chunks(knowledge_source_id);
CREATE INDEX IF NOT EXISTS idx_kc_client_id   ON knowledge_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_kc_workflow_id ON knowledge_chunks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_kc_category    ON knowledge_chunks(category);

-- ─── knowledge_extractions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_extractions (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  knowledge_source_id  TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  client_id            TEXT,
  workflow_id          TEXT,
  extracted_type       TEXT NOT NULL,
  extracted_data       JSONB NOT NULL DEFAULT '{}',
  confidence_score     REAL NOT NULL DEFAULT 0.0,
  approved             BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ke_source_id   ON knowledge_extractions(knowledge_source_id);
CREATE INDEX IF NOT EXISTS idx_ke_client_id   ON knowledge_extractions(client_id);
CREATE INDEX IF NOT EXISTS idx_ke_workflow_id ON knowledge_extractions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ke_type        ON knowledge_extractions(extracted_type);
CREATE INDEX IF NOT EXISTS idx_ke_approved    ON knowledge_extractions(approved);

-- ─── knowledge_embeddings ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  knowledge_chunk_id   TEXT NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  client_id            TEXT,
  workflow_id          TEXT,
  embedding            JSONB NOT NULL DEFAULT '[]', -- array of floats
  model                TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kemb_chunk_id    ON knowledge_embeddings(knowledge_chunk_id);
CREATE INDEX IF NOT EXISTS idx_kemb_client_id   ON knowledge_embeddings(client_id);
CREATE INDEX IF NOT EXISTS idx_kemb_workflow_id ON knowledge_embeddings(workflow_id);

-- ─── agent_knowledge_links ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_knowledge_links (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id             TEXT,
  workflow_id          TEXT,
  knowledge_source_id  TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_akl_agent_id    ON agent_knowledge_links(agent_id);
CREATE INDEX IF NOT EXISTS idx_akl_workflow_id ON agent_knowledge_links(workflow_id);
CREATE INDEX IF NOT EXISTS idx_akl_source_id   ON agent_knowledge_links(knowledge_source_id);
CREATE INDEX IF NOT EXISTS idx_akl_active      ON agent_knowledge_links(active);

-- ─── Row Level Security ─────────────────────────────────────────────

-- Enable RLS on all knowledge tables
ALTER TABLE knowledge_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_links ENABLE ROW LEVEL SECURITY;

-- Helper function: get the current user's role from profiles table
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.role
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Helper function: get the current user's client_id from profiles table
CREATE OR REPLACE FUNCTION get_current_user_client_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.client_id
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- ─── knowledge_sources policies ─────────────────────────────────────

-- SELECT: admins see all; client roles see their own client's sources
CREATE POLICY ks_select ON knowledge_sources
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin', 'operator')
    OR client_id = get_current_user_client_id()
  );

-- INSERT: admins + client_owner (client_operator excluded)
CREATE POLICY ks_insert ON knowledge_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- UPDATE: admins + client_owner
CREATE POLICY ks_update ON knowledge_sources
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- DELETE: admins + client_owner (NOT client_operator)
CREATE POLICY ks_delete ON knowledge_sources
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- ─── knowledge_chunks policies ──────────────────────────────────────

CREATE POLICY kc_select ON knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin', 'operator')
    OR client_id = get_current_user_client_id()
  );

CREATE POLICY kc_insert ON knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

CREATE POLICY kc_update ON knowledge_chunks
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

CREATE POLICY kc_delete ON knowledge_chunks
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- ─── knowledge_extractions policies ─────────────────────────────────

CREATE POLICY ke_select ON knowledge_extractions
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin', 'operator')
    OR client_id = get_current_user_client_id()
  );

CREATE POLICY ke_insert ON knowledge_extractions
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

CREATE POLICY ke_update ON knowledge_extractions
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

CREATE POLICY ke_delete ON knowledge_extractions
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- ─── knowledge_embeddings policies ──────────────────────────────────

CREATE POLICY kemb_select ON knowledge_embeddings
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin', 'operator')
    OR client_id = get_current_user_client_id()
  );

CREATE POLICY kemb_insert ON knowledge_embeddings
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

CREATE POLICY kemb_delete ON knowledge_embeddings
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND client_id = get_current_user_client_id()
    )
  );

-- ─── agent_knowledge_links policies ─────────────────────────────────

CREATE POLICY akl_select ON agent_knowledge_links
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin', 'operator')
    OR workflow_id IN (
      SELECT w.id FROM workflows w
      JOIN projects p ON w.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY akl_insert ON agent_knowledge_links
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND workflow_id IN (
        SELECT w.id FROM workflows w
        JOIN projects p ON w.project_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY akl_update ON agent_knowledge_links
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND workflow_id IN (
        SELECT w.id FROM workflows w
        JOIN projects p ON w.project_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY akl_delete ON agent_knowledge_links
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'admin')
    OR (
      get_current_user_role() = 'client_owner'
      AND workflow_id IN (
        SELECT w.id FROM workflows w
        JOIN projects p ON w.project_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- ─── Public/anon users: NO access ───────────────────────────────────
-- The policies above are TO authenticated only, so anon users
-- are denied by default. No explicit policy needed.
