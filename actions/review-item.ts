import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  loadHackathon,
  loadItem,
  logActivity,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Person-only: approve, reject, or reopen a checklist item from the app UI. Agents cannot approve; this fails with approval_requires_person for any non-browser caller. Ask the person to review in the app instead.",
  schema: z.object({
    id: z.string().describe("Checklist item id"),
    decision: z
      .enum(["approve", "reject", "reopen"])
      .describe("approve = accept the draft (or `value`) as final; reject = discard the draft; reopen = move an approved item back to todo"),
    value: z
      .string()
      .max(5000)
      .optional()
      .describe("Final value when the person edited the draft before approving"),
  }),
  run: async ({ id, decision, value }, ctx) => {
    if (ctx?.caller !== "frontend")
      fail(
        "Only the person can approve or reject checklist items, from the Hackpilot screen. Ask them to review it there.",
        { errorCode: "approval_requires_person", statusCode: 403 },
      );
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const item = await loadItem(id, email, orgId);
    const hackathon = await loadHackathon(item.hackathonId, email, orgId);
    if (hackathon.status === "submitted")
      fail("Already marked submitted. Reopen the hackathon first.", {
        errorCode: "already_submitted",
        statusCode: 409,
      });
    const c = schema.checklistItems;
    const now = new Date().toISOString();
    if (decision === "approve") {
      const finalValue = (value ?? item.draft ?? item.value ?? "").trim();
      if (item.kind === "field" && !finalValue)
        fail("Nothing to approve yet: add a value or ask the agent for a draft.", {
          errorCode: "empty_value",
          statusCode: 409,
        });
      await getDb()
        .update(c)
        .set({ value: finalValue || "Done", draft: null, rationale: null, state: "approved", updatedAt: now })
        .where(eq(c.id, id));
      await logActivity(item.hackathonId, "person", `Approved "${item.label}"${value !== undefined && value !== item.draft ? " (edited)" : ""}`, email, orgId);
      return { id, state: "approved" as const };
    }
    if (decision === "reject") {
      await getDb()
        .update(c)
        .set({ draft: null, rationale: null, state: item.value ? "approved" : "todo", updatedAt: now })
        .where(eq(c.id, id));
      await logActivity(item.hackathonId, "person", `Rejected the draft for "${item.label}"`, email, orgId);
      return { id, state: item.value ? ("approved" as const) : ("todo" as const) };
    }
    await getDb()
      .update(c)
      .set({ state: "todo", updatedAt: now })
      .where(eq(c.id, id));
    await logActivity(item.hackathonId, "person", `Reopened "${item.label}"`, email, orgId);
    return { id, state: "todo" as const };
  },
});
