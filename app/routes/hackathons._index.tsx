import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconClockHour4,
  IconPlus,
  IconSparkles,
  IconTrophy,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Countdown, ProgressBar } from "@/components/hackpilot/Countdown";
import {
  COMMON_ZONES,
  formatInZone,
  useLocalZone,
} from "@/components/hackpilot/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` -> ISO with that zone's offset. */
function zonedToIso(local: string, timeZone: string) {
  const asUtc = Date.parse(local + ":00Z");
  if (Number.isNaN(asUtc)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = shown - asUtc;
  return new Date(asUtc - offset).toISOString();
}

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  building: "Building",
  submitted: "Submitted",
};

function askAgentToSetUp() {
  sendToAgentChat({
    message:
      "Set up a new hackathon from these rules and build its submission checklist:\n\n",
    submit: false,
    openSidebar: true,
  });
}

export default function HackathonsIndex() {
  const navigate = useNavigate();
  const localZone = useLocalZone();
  const { data, isPending } = useActionQuery("list-hackathons", {});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [zone, setZone] = useState("America/Los_Angeles");
  const create = useActionMutation("create-hackathon", {
    onSuccess: (result) => {
      toast.success("Hackathon added");
      setOpen(false);
      setName("");
      setDeadline("");
      navigate(`/hackathons/${result.id}`);
    },
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not add the hackathon."),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const iso = zonedToIso(deadline, zone);
    if (!name.trim() || !iso) {
      toast.error("Add a name and a deadline.");
      return;
    }
    create.mutate({ name: name.trim(), deadlineAt: iso, deadlineTz: zone, items: [] });
  }

  const hackathons = data?.hackathons ?? [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Hackpilot
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Paste the rules. Your agent drafts the entry. You approve every word.
            </h1>
            <p className="text-sm text-muted-foreground">
              Every requirement becomes a checklist item the agent can draft and only
              you can sign off. Nothing gets marked submitted until all of it is approved.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={askAgentToSetUp}>
              <IconSparkles className="size-4" />
              Set up from rules
            </Button>
            <Button variant="outline" onClick={() => setOpen((v) => !v)}>
              <IconPlus className="size-4" />
              Add manually
            </Button>
          </div>
        </div>
        {open ? (
          <form
            onSubmit={submit}
            className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="h-name">Name</Label>
              <Input id="h-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-deadline">Deadline (organizer's time)</Label>
              <Input id="h-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-zone">Organizer time zone</Label>
              <select
                id="h-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {Array.from(new Set([...COMMON_ZONES, localZone])).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </form>
        ) : null}
      </section>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : hackathons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <IconTrophy className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hackathons yet. Paste a rules page into the agent to start.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {hackathons.map((h) => (
            <Link
              key={h.id}
              to={`/hackathons/${h.id}`}
              className={cn(
                "group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
                h.status === "submitted" && "opacity-80",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{h.name}</h2>
                  {h.prize ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{h.prize}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    h.status === "submitted"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : h.status === "building"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[h.status] ?? h.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <IconClockHour4 className="size-4 text-muted-foreground" />
                <Countdown deadlineAt={h.deadlineAt} />
                <span className="truncate text-xs text-muted-foreground">
                  · {formatInZone(h.deadlineAt, localZone)}
                </span>
              </div>
              <div className="space-y-1.5">
                <ProgressBar percent={h.progress.percent} ready={h.progress.ready} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {h.progress.approvedCount}/{h.progress.requiredCount} approved
                  </span>
                  {h.progress.awaitingReviewCount ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {h.progress.awaitingReviewCount} draft
                      {h.progress.awaitingReviewCount === 1 ? "" : "s"} to review
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
