import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadHackathon, requireUser } from "../server/lib/hackpilot.js";

export default defineAction({
  description:
    "Build the copy-paste submission packet: every approved field value in form order, as Markdown. Unapproved items are listed as missing, never filled in.",
  schema: z.object({ id: z.string().describe("Hackathon id") }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ id }, ctx) => {
    const email = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const hackathon = await loadHackathon(id, email, orgId);
    const c = schema.checklistItems;
    const items = await getDb()
      .select({ label: c.label, kind: c.kind, value: c.value, state: c.state, required: c.required })
      .from(c)
      .where(eq(c.hackathonId, id))
      .orderBy(asc(c.position))
      .limit(200);
    const lines = [`# ${hackathon.name} — submission packet`, ""];
    const missing: string[] = [];
    for (const item of items) {
      if (item.state !== "approved") {
        if (item.required) missing.push(item.label);
        continue;
      }
      if (item.kind === "task") {
        lines.push(`- [x] ${item.label}${item.value && item.value !== "Done" ? `: ${item.value}` : ""}`);
      } else {
        lines.push(`## ${item.label}`, "", item.value ?? "", "");
      }
    }
    if (missing.length) lines.push("", `> Still missing: ${missing.join(", ")}`);
    return { markdown: lines.join("\n"), missing };
  },
});
