import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  loadHackathon,
  readiness,
  requireUser,
} from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Get one hackathon with its full submission checklist (each item's label, kind, guidance, agent draft, approved value, state) plus readiness and recent activity. Use before drafting fields.",
  schema: z.object({
    id: z.string().describe("Hackathon id from list-hackathons"),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "hackathons",
      to: `/hackathons/${encodeURIComponent(args.id)}`,
      params: { hackathonId: args.id },
    }),
    label: "Open checklist",
  }),
  run: async ({ id }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const hackathon = await loadHackathon(id, email, orgId);
    const c = schema.checklistItems;
    const items = await getDb()
      .select({
        id: c.id,
        label: c.label,
        kind: c.kind,
        required: c.required,
        guidance: c.guidance,
        draft: c.draft,
        rationale: c.rationale,
        value: c.value,
        state: c.state,
        position: c.position,
        updatedAt: c.updatedAt,
      })
      .from(c)
      .where(eq(c.hackathonId, id))
      .orderBy(asc(c.position), asc(c.label))
      .limit(200);
    const a = schema.activity;
    const activity = await getDb()
      .select({
        id: a.id,
        actor: a.actor,
        message: a.message,
        createdAt: a.createdAt,
      })
      .from(a)
      .where(eq(a.hackathonId, id))
      .orderBy(desc(a.createdAt))
      .limit(40);
    const now = Date.now();
    return {
      hackathon: {
        id: hackathon.id,
        name: hackathon.name,
        url: hackathon.url,
        prize: hackathon.prize,
        deadlineAt: hackathon.deadlineAt,
        deadlineTz: hackathon.deadlineTz,
        status: hackathon.status,
        submittedAt: hackathon.submittedAt,
        hoursLeft: Math.round((Date.parse(hackathon.deadlineAt) - now) / 36e5),
      },
      items,
      readiness: readiness(items),
      activity,
    };
  },
});
