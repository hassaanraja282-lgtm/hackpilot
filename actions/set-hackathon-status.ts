import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorFor,
  loadHackathon,
  logActivity,
  readiness,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Move a hackathon between planning, building, and submitted. Marking it submitted is person-only and fails with not_ready (409) while any required checklist item is not approved; the error lists what is missing.",
  schema: z.object({
    id: z.string().describe("Hackathon id"),
    status: z.enum(["planning", "building", "submitted"]).describe("New status"),
  }),
  run: async ({ id, status }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const hackathon = await loadHackathon(id, email, orgId);
    const actor = actorFor(ctx);
    const c = schema.checklistItems;
    if (status === "submitted") {
      if (actor !== "person")
        fail("Only the person can mark a hackathon submitted, from the app.", {
          errorCode: "approval_requires_person",
          statusCode: 403,
        });
      const items = await getDb()
        .select({ id: c.id, label: c.label, required: c.required, state: c.state })
        .from(c)
        .where(eq(c.hackathonId, id))
        .limit(200);
      const r = readiness(items);
      if (!r.ready)
        fail(
          `Not ready: ${r.missing.length} required item${r.missing.length === 1 ? "" : "s"} still need approval (${r.missing.map((m) => m.label).join(", ")}).`,
          { errorCode: "not_ready", statusCode: 409, details: { missing: r.missing } },
        );
    }
    const h = schema.hackathons;
    await getDb()
      .update(h)
      .set({ status, submittedAt: status === "submitted" ? new Date().toISOString() : null })
      .where(eq(h.id, id));
    await logActivity(id, actor, `Status: ${hackathon.status} → ${status}`, email, orgId);
    return { id, status };
  },
});
