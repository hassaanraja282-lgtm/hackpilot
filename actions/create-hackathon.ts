import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  actorFor,
  itemSchema,
  isValidTimeZone,
  requireUser,
  toIso,
} from "../server/lib/hackpilot.js";


export default defineAction({
  description:
    "Create a hackathon to track, with its deadline and (optionally) its whole submission checklist in one call. When the user pastes rules or a hackathon page, extract every required submission field and task into `items`.",
  schema: z.object({
    name: z.string().min(1).max(120).describe("Hackathon name"),
    url: z.string().url().optional().describe("Hackathon or rules page URL"),
    prize: z.string().max(120).optional().describe('Prize summary, e.g. "$10,000 across 5 places"'),
    deadlineAt: z
      .string()
      .describe("Final submission deadline, ISO 8601 with offset, e.g. 2026-11-09T23:59:00-08:00"),
    deadlineTz: z
      .string()
      .default("UTC")
      .describe("IANA time zone the organizer states the deadline in, e.g. America/Los_Angeles"),
    items: z
      .array(itemSchema)
      .max(40)
      .default([])
      .describe("Submission checklist items, in the order the form asks for them"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "hackathons",
      to: `/hackathons/${encodeURIComponent(result.id)}`,
      params: { hackathonId: result.id },
    }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    if (!isValidTimeZone(args.deadlineTz))
      fail(`Unknown time zone "${args.deadlineTz}". Use an IANA name like America/Los_Angeles.`, {
        errorCode: "invalid_time_zone",
      });
    const deadlineAt = toIso(args.deadlineAt, "deadlineAt");
    const id = crypto.randomUUID();
    const actor = actorFor(ctx);
    const now = new Date().toISOString();
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.hackathons).values({
        id,
        name: args.name,
        url: args.url ?? null,
        prize: args.prize ?? null,
        deadlineAt,
        deadlineTz: args.deadlineTz,
        ownerEmail: email,
        orgId,
      });
      if (args.items.length) {
        await tx.insert(schema.checklistItems).values(
          args.items.map((item, index) => ({
            id: crypto.randomUUID(),
            hackathonId: id,
            label: item.label,
            kind: item.kind,
            required: item.required,
            guidance: item.guidance ?? null,
            position: index,
            ownerEmail: email,
            orgId,
            updatedAt: now,
          })),
        );
      }
      await tx.insert(schema.activity).values({
        id: crypto.randomUUID(),
        hackathonId: id,
        actor,
        message: `Created "${args.name}" with ${args.items.length} checklist item${args.items.length === 1 ? "" : "s"}`,
        ownerEmail: email,
        orgId,
        createdAt: now,
      });
    });
    return { id, name: args.name, deadlineAt, itemCount: args.items.length };
  },
});
