import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "hackathons-checklists-activity",
      sql: `CREATE TABLE IF NOT EXISTS hackathons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  prize TEXT,
  deadline_at TEXT NOT NULL,
  deadline_tz TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'building', 'submitted')),
  submitted_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'field' CHECK (kind IN ('field', 'task')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  guidance TEXT,
  draft TEXT,
  rationale TEXT,
  value TEXT,
  state TEXT NOT NULL DEFAULT 'todo' CHECK (state IN ('todo', 'proposed', 'approved')),
  position INTEGER NOT NULL DEFAULT 0,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS hackathon_activity (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  actor TEXT NOT NULL CHECK (actor IN ('agent', 'person')),
  message TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hackathons_owner_deadline_idx ON hackathons (owner_email, org_id, deadline_at);
CREATE INDEX IF NOT EXISTS checklist_items_hackathon_idx ON checklist_items (hackathon_id, position);
CREATE INDEX IF NOT EXISTS hackathon_activity_hackathon_idx ON hackathon_activity (hackathon_id, created_at)`,
    },
  ],
  { table: "hackpilot_migrations" },
);
