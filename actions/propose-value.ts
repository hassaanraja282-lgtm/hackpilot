import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorFor,
  loadHackathon,
  loadItem,
  logActivity,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Propose a draft value for a checklist item (a form field's text, or proof a task is done such as a URL). The item moves to 'proposed' and waits for the person to approve, edit, or reject it in the app. Drafting never approves. Replaces any earlier draft; an already-approved item is reopened for review.",
  schema: z.object({
    id: z.string().describe("Checklist item id from get-hackathon"),
    draft: z.string().min(1).max(5000).describe("The proposed text or URL, exactly as it should be submitted"),
    rationale: z
      .string()
      .max(400)
      .optional()
      .describe("One or two sentences: which rule this satisfies and any assumption the person should check"),
  }),
  run: async ({ id, draft, rationale }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const item = await loadItem(id, email, orgId);
    const hackathon = await loadHackathon(item.hackathonId, email, orgId);
    if (hackathon.status === "submitted")
      fail("This hackathon is already marked submitted; reopen it before changing drafts.", {
        errorCode: "already_submitted",
        statusCode: 409,
      });
    const c = schema.checklistItems;
    await getDb()
      .update(c)
      .set({
        draft,
        rationale: rationale ?? null,
        state: "proposed",
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(c.id, id)));
    const actor = actorFor(ctx);
    await logActivity(
      item.hackathonId,
      actor,
      `${actor === "agent" ? "Drafted" : "Edited draft for"} "${item.label}"${item.state === "approved" ? " (reopened for review)" : ""}`,
      email,
      orgId,
    );
    return { id, label: item.label, state: "proposed" as const };
  },
});
