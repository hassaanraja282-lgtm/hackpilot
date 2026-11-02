import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { ownerScope, readiness, requireUser } from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "List the user's hackathons, soonest deadline first, with checklist progress (approved / required, drafts awaiting review) and time left.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "hackathons", to: "/hackathons" }),
    label: "Open Hackathons",
  }),
  run: async (_args, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const h = schema.hackathons;
    const rows = await getDb()
      .select({
        id: h.id,
        name: h.name,
        url: h.url,
        prize: h.prize,
        deadlineAt: h.deadlineAt,
        deadlineTz: h.deadlineTz,
        status: h.status,
        submittedAt: h.submittedAt,
      })
      .from(h)
      .where(ownerScope(h, email, orgId))
      .orderBy(asc(h.deadlineAt))
      .limit(100);
    const ids = rows.map((r) => r.id);
    const c = schema.checklistItems;
    const items = ids.length
      ? await getDb()
          .select({
            id: c.id,
            hackathonId: c.hackathonId,
            label: c.label,
            required: c.required,
            state: c.state,
          })
          .from(c)
          .where(inArray(c.hackathonId, ids))
          .limit(2000)
      : [];
    const now = Date.now();
    return {
      now: new Date(now).toISOString(),
      hackathons: rows.map((r) => {
        const r2 = readiness(items.filter((i) => i.hackathonId === r.id));
        return {
          ...r,
          hoursLeft: Math.round((Date.parse(r.deadlineAt) - now) / 36e5),
          progress: {
            requiredCount: r2.requiredCount,
            approvedCount: r2.approvedCount,
            awaitingReviewCount: r2.awaitingReviewCount,
            percent: r2.percent,
            ready: r2.ready,
          },
        };
      }),
    };
  },
});
