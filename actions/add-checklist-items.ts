import { defineAction } from "@agent-native/core/action";
import { eq, max } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorFor,
  itemSchema,
  loadHackathon,
  logActivity,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Add one or more requirements to a hackathon's submission checklist in a single call.",
  schema: z.object({
    hackathonId: z.string().describe("Hackathon id"),
    items: z.array(itemSchema).min(1).max(40).describe("Items to append"),
  }),
  run: async ({ hackathonId, items }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    await loadHackathon(hackathonId, email, orgId);
    const c = schema.checklistItems;
    const [maxRow] = await getDb()
      .select({ top: max(c.position) })
      .from(c)
      .where(eq(c.hackathonId, hackathonId));
    const start = (maxRow?.top ?? -1) + 1;
    const now = new Date().toISOString();
    const rows = items.map((item, index) => ({
      id: crypto.randomUUID(),
      hackathonId,
      label: item.label,
      kind: item.kind,
      required: item.required,
      guidance: item.guidance ?? null,
      position: start + index,
      ownerEmail: email,
      orgId,
      updatedAt: now,
    }));
    await getDb().insert(c).values(rows);
    await logActivity(
      hackathonId,
      actorFor(ctx),
      `Added ${rows.length} checklist item${rows.length === 1 ? "" : "s"}: ${rows.map((r) => r.label).join(", ")}`,
      email,
      orgId,
    );
    return { added: rows.map((r) => ({ id: r.id, label: r.label })) };
  },
});
