import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

// Hackathons a person is entering. Private to their creator (owner_email),
// scoped to the active org when there is one.
export const hackathons = pgTable("hackathons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  prize: text("prize"),
  // Normalized UTC ISO string (Date#toISOString) so string order = time order.
  deadlineAt: text("deadline_at").notNull(),
  // IANA zone the organizer states the deadline in, for display.
  deadlineTz: text("deadline_tz").notNull().default("UTC"),
  status: text("status", {
    enum: ["planning", "building", "submitted"],
  })
    .notNull()
    .default("planning"),
  submittedAt: text("submitted_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// One requirement on the submission checklist. A "field" is text that goes
// into the submission form; a "task" is something that must get done.
// state: todo -> proposed (agent drafted) -> approved (a person signed off).
export const checklistItems = pgTable("checklist_items", {
  id: text("id").primaryKey(),
  hackathonId: text("hackathon_id").notNull(),
  label: text("label").notNull(),
  kind: text("kind", { enum: ["field", "task"] })
    .notNull()
    .default("field"),
  required: boolean("required").notNull().default(true),
  guidance: text("guidance"),
  draft: text("draft"),
  rationale: text("rationale"),
  value: text("value"),
  state: text("state", { enum: ["todo", "proposed", "approved"] })
    .notNull()
    .default("todo"),
  position: integer("position").notNull().default(0),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Who did what, so the person can see exactly what the agent touched.
export const activity = pgTable("hackathon_activity", {
  id: text("id").primaryKey(),
  hackathonId: text("hackathon_id").notNull(),
  actor: text("actor", { enum: ["agent", "person"] }).notNull(),
  message: text("message").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at").notNull(),
});
