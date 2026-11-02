import { fail } from "@agent-native/core/action";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../db/index.js";

export type Actor = "agent" | "person";

/** Who is calling: the browser UI is the person; every other surface is the agent or a script. */
export function actorFor(ctx: { caller?: string } | undefined): Actor {
  return ctx?.caller === "frontend" ? "person" : "agent";
}

export function requireUser(ctx: { userEmail?: string | null } | undefined) {
  return (
    ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 })
  ) as string;
}

export function toIso(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    fail(`${field} must be an ISO 8601 date-time with a UTC offset.`, {
      errorCode: "invalid_time",
    });
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    fail(`${field} must be an ISO 8601 date-time.`, {
      errorCode: "invalid_time",
    });
  }
  return new Date(ms).toISOString();
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function ownerScope(
  table: { ownerEmail: any; orgId: any },
  email: string,
  orgId: string | null,
) {
  return and(
    eq(table.ownerEmail, email),
    orgId ? eq(table.orgId, orgId) : isNull(table.orgId),
  );
}

/** Load a hackathon the caller owns, or fail with 404. */
export async function loadHackathon(id: string, email: string, orgId: string | null) {
  const h = schema.hackathons;
  const [row] = await getDb()
    .select()
    .from(h)
    .where(and(eq(h.id, id), ownerScope(h, email, orgId)))
    .limit(1);
  if (!row)
    fail("Hackathon not found.", { errorCode: "not_found", statusCode: 404 });
  return row!;
}

/** Load a checklist item the caller owns, or fail with 404. */
export async function loadItem(id: string, email: string, orgId: string | null) {
  const c = schema.checklistItems;
  const [row] = await getDb()
    .select()
    .from(c)
    .where(and(eq(c.id, id), ownerScope(c, email, orgId)))
    .limit(1);
  if (!row)
    fail("Checklist item not found.", {
      errorCode: "not_found",
      statusCode: 404,
    });
  return row!;
}

export async function logActivity(
  hackathonId: string,
  actor: Actor,
  message: string,
  email: string,
  orgId: string | null,
) {
  await getDb()
    .insert(schema.activity)
    .values({
      id: crypto.randomUUID(),
      hackathonId,
      actor,
      message: message.slice(0, 280),
      ownerEmail: email,
      orgId,
      createdAt: new Date().toISOString(),
    });
}

export type ItemRow = typeof schema.checklistItems.$inferSelect;

export function readiness(items: Pick<ItemRow, "required" | "state" | "label" | "id">[]) {
  const required = items.filter((i) => i.required);
  const approved = required.filter((i) => i.state === "approved");
  const awaitingReview = items.filter((i) => i.state === "proposed");
  const missing = required.filter((i) => i.state !== "approved");
  return {
    requiredCount: required.length,
    approvedCount: approved.length,
    awaitingReviewCount: awaitingReview.length,
    missing: missing.map((i) => ({ id: i.id, label: i.label, state: i.state })),
    ready: required.length > 0 && missing.length === 0,
    percent: required.length
      ? Math.round((approved.length / required.length) * 100)
      : 0,
  };
}

export const checklistItemInput = {
  label: "Requirement name, e.g. \"Public demo video URL\"",
  kind: "field = text that goes into the submission form; task = something to get done (e.g. deploy the app)",
  required: "Whether the submission is incomplete without it (default true)",
  guidance: "What the rules say about it, quoted or paraphrased, incl. limits like word counts",
};

export const itemSchema = z.object({
  label: z.string().min(1).max(120).describe(checklistItemInput.label),
  kind: z.enum(["field", "task"]).default("field").describe(checklistItemInput.kind),
  required: z.boolean().default(true).describe(checklistItemInput.required),
  guidance: z.string().max(600).optional().describe(checklistItemInput.guidance),
});
