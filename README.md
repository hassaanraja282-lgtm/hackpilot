# Hackpilot

**Paste the rules. Your agent drafts the entry. You approve every word.**

Hackpilot is a hackathon submission copilot built on the open-source
[Agent-Native](https://www.agent-native.com) framework. Hackathon rules pages are
long, deadlines come in someone else's time zone, and submission forms ask for
the same ten things in slightly different words. Hackpilot turns a rules page
into a checklist, lets the agent draft every field, and keeps a person in charge
of what actually gets submitted.

Built for the [builder.io Agent-Native Hackathon](https://www.builder.io/hackathon) (Oct 27 – Nov 9, 2026).

## What it does

- **Rules → checklist.** Paste a rules page into the agent. It calls
  `create-hackathon` once with the deadline (as the organizer states it, with
  their IANA zone) and every submission requirement as a `field` (form text)
  or `task` (work like "deploy" or "record a demo"), with the rule's own wording
  as guidance.
- **Agent drafts, person approves.** "Draft with agent" on any item (or
  "Draft all") starts a visible agent turn that calls `propose-value`. Drafts
  land in an amber review box with the agent's rationale. You can Approve,
  Edit & approve, or Reject.
- **Approval is enforced on the server, not just the UI.** `review-item`
  rejects every caller except the browser (`ctx.caller === "frontend"`) with
  `approval_requires_person`. The agent, MCP clients, the CLI and A2A callers
  can draft; only the person can sign off.
- **Can't mark submitted until it's really ready.** `set-hackathon-status`
  refuses `submitted` with `not_ready` (409) and names every required item that
  isn't approved.
- **Deadline sanity.** Live countdown that turns amber inside a week and red
  inside 48 hours, with the deadline shown in the organizer's zone *and* yours.
- **Who did what.** Every change is logged with its actor (agent or you), so
  you can see exactly what the agent touched.
- **Submission packet.** One click copies every approved value, in form order,
  as Markdown, ready to paste into the organizer's form. Unapproved items are
  listed as missing, never filled in.

## How it uses Agent-Native

One set of typed actions in `actions/` powers the React UI (`useActionQuery` /
`useActionMutation`), the in-app agent (as tools), the CLI, HTTP and MCP:

| Action | Purpose |
| --- | --- |
| `list-hackathons` | Hackathons, soonest deadline first, with progress |
| `get-hackathon` | One hackathon: checklist, readiness, activity |
| `create-hackathon` | Hackathon + whole checklist in one transaction |
| `add-checklist-items` | Append requirements (batch) |
| `propose-value` | Agent/person draft → `proposed` |
| `review-item` | **Person-only** approve / reject / reopen |
| `set-hackathon-status` | `submitted` is person-only and gated on readiness |
| `delete-checklist-item` | Drop an item that doesn't apply |
| `export-submission` | Markdown packet of approved values |

Buttons in the UI hand AI work to the agent sidebar with `sendToAgentChat`
(with the hackathon and item ids as context), the agent's tool writes refresh
the screen automatically, and `navigation` exposes `hackathonId` so "draft this
one" works from whatever page you're on.

## Run it

```bash
pnpm install
pnpm dev          # local PGlite database, no setup
```

Set an LLM key in `.env` (for example `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini,
or `ANTHROPIC_API_KEY`), or connect one in the app's settings.

Deploy: `render.yaml` is a Render Blueprint (free web service + free Postgres).
Set `GOOGLE_GENERATIVE_AI_API_KEY` when Render asks.

## Pre-existing work and disclosure

- Scaffolded on Nov 2, 2026 from the Agent-Native **Chat** template
  (`npx @agent-native/core@0.222.2 create --template chat`). The app shell,
  auth, chat, settings, i18n catalog and UI primitives come from that template.
- New for this hackathon: everything under `actions/` except `hello`, `navigate`,
  `run`, `view-screen` and `provider-api-request`; `server/db/*`,
  `server/lib/hackpilot.ts`, `server/plugins/db.ts`; `app/routes/hackathons*.tsx`;
  `app/components/hackpilot/*`; the Hackathons sidebar link, navigation state,
  agent system prompt and `render.yaml`.
- Built with AI coding assistance. Libraries: Agent-Native, React Router,
  Drizzle, Tabler icons, Tailwind (all via the template).

## License

MIT © 2026 Raja Hassaan
