import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorFor,
  loadItem,
  logActivity,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description: "Remove a checklist item that does not apply.",
  schema: z.object({ id: z.string().describe("Checklist item id") }),
  run: async ({ id }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const item = await loadItem(id, email, orgId);
    await getDb().delete(schema.checklistItems).where(eq(schema.checklistItems.id, id));
    await logActivity(item.hackathonId, actorFor(ctx), `Removed "${item.label}"`, email, orgId);
    return { id, deleted: true };
  },
});
