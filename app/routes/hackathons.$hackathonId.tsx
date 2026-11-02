import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboardCopy,
  IconExternalLink,
  IconPencil,
  IconRobot,
  IconRotate,
  IconSend,
  IconSparkles,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Countdown, ProgressBar, useNow } from "@/components/hackpilot/Countdown";
import { formatInZone, useLocalZone } from "@/components/hackpilot/time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  kind: "field" | "task";
  required: boolean;
  guidance: string | null;
  draft: string | null;
  rationale: string | null;
  value: string | null;
  state: "todo" | "proposed" | "approved";
};

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "errorCode" in error) {
    const code = (error as { errorCode?: unknown }).errorCode;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function relative(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StateChip({ state }: { state: Item["state"] }) {
  const map = {
    todo: ["To do", "bg-muted text-muted-foreground"],
    proposed: ["Agent draft · review", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
    approved: ["Approved", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  } as const;
  const [label, cls] = map[state];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>{label}</span>;
}

function ChecklistItem({
  item,
  hackathonId,
  hackathonName,
  locked,
}: {
  item: Item;
  hackathonId: string;
  hackathonName: string;
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["action", "get-hackathon", { id: hackathonId }];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const review = useActionMutation("review-item", {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) =>
        old && {
          ...old,
          items: old.items.map((i: Item) =>
            i.id !== input.id
              ? i
              : input.decision === "approve"
                ? { ...i, state: "approved", value: input.value ?? i.draft ?? i.value, draft: null }
                : input.decision === "reject"
                  ? { ...i, draft: null, state: i.value ? "approved" : "todo" }
                  : { ...i, state: "todo" },
          ),
        },
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(queryKey, (context as { previous?: unknown })?.previous);
      toast.error(actionErrorMessage(error) ?? "Could not save your review.");
    },
    onSuccess: () => setEditing(false),
  });

  function draftWithAgent() {
    sendToAgentChat({
      message: `Draft "${item.label}" for ${hackathonName}.`,
      context: JSON.stringify({ hackathonId, itemId: item.id }),
      submit: true,
      openSidebar: true,
    });
  }

  const busy = review.isPending || locked;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 transition",
        item.state === "proposed" ? "border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        {item.state === "approved" ? (
          <IconCircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        ) : item.state === "proposed" ? (
          <IconRobot className="mt-0.5 size-5 shrink-0 text-amber-500" />
        ) : (
          <IconCircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{item.label}</h3>
            <span className="rounded border border-border px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.kind}
            </span>
            {!item.required ? <span className="text-[11px] text-muted-foreground">optional</span> : null}
            <StateChip state={item.state} />
          </div>
          {item.guidance ? <p className="text-xs text-muted-foreground">{item.guidance}</p> : null}

          {item.state === "approved" && item.value && !editing ? (
            <p className="whitespace-pre-wrap break-words rounded-lg bg-emerald-500/5 p-3 text-sm">{item.value}</p>
          ) : null}

          {item.state === "proposed" && item.draft && !editing ? (
            <div className="space-y-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
              <p className="whitespace-pre-wrap break-words text-sm">{item.draft}</p>
              {item.rationale ? (
                <p className="flex gap-1.5 text-xs italic text-muted-foreground">
                  <IconSparkles className="mt-0.5 size-3.5 shrink-0" />
                  {item.rationale}
                </p>
              ) : null}
            </div>
          ) : null}

          {editing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={Math.min(12, Math.max(3, text.split("\n").length + 1))}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !text.trim()}
                  onClick={() => review.mutate({ id: item.id, decision: "approve", value: text.trim() })}
                >
                  <IconCheck className="size-4" /> Save & approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.state === "proposed" ? (
                <>
                  <Button size="sm" disabled={busy} onClick={() => review.mutate({ id: item.id, decision: "approve" })}>
                    <IconCheck className="size-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setText(item.draft ?? "");
                      setEditing(true);
                    }}
                  >
                    <IconPencil className="size-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => review.mutate({ id: item.id, decision: "reject" })}>
                    <IconX className="size-4" /> Reject
                  </Button>
                </>
              ) : null}
              {item.state === "todo" ? (
                <>
                  <Button size="sm" variant="outline" disabled={locked} onClick={draftWithAgent}>
                    <IconSparkles className="size-4" /> Draft with agent
                  </Button>
                  {item.kind === "task" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => review.mutate({ id: item.id, decision: "approve", value: "Done" })}>
                      <IconCheck className="size-4" /> Mark done
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setText(item.value ?? "");
                        setEditing(true);
                      }}
                    >
                      <IconPencil className="size-4" /> Write it myself
                    </Button>
                  )}
                </>
              ) : null}
              {item.state === "approved" && !locked ? (
                <>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => review.mutate({ id: item.id, decision: "reopen" })}>
                    <IconRotate className="size-4" /> Reopen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={draftWithAgent}>
                    <IconSparkles className="size-4" /> Ask agent to improve
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function HackathonDetail() {
  const { hackathonId = "" } = useParams();
  const localZone = useLocalZone();
  const now = useNow(30_000);
  const { data, isPending, error } = useActionQuery("get-hackathon", { id: hackathonId });
  const exportQuery = useActionQuery("export-submission", { id: hackathonId });
  const setStatus = useActionMutation("set-hackathon-status", {
    onSuccess: (r) => toast.success(r.status === "submitted" ? "Marked submitted. Good luck!" : "Status updated"),
    onError: (err) =>
      toast.error(
        errorCode(err) === "not_ready"
          ? (actionErrorMessage(err) ?? "Not ready yet.")
          : (actionErrorMessage(err) ?? "Could not update status."),
      ),
  });

  if (isPending) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 sm:p-8">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Hackathon not found.</p>
        <Link to="/hackathons" className="mt-2 inline-block text-sm underline">
          Back to hackathons
        </Link>
      </main>
    );
  }

  const { hackathon, items, readiness, activity } = data;
  const locked = hackathon.status === "submitted";
  const proposed = items.filter((i) => i.state === "proposed").length;
  const todo = items.filter((i) => i.state === "todo").length;

  function draftAll() {
    sendToAgentChat({
      message: `Draft every checklist item that is still to do for ${hackathon.name}. Ask me for any fact you don't have.`,
      context: JSON.stringify({ hackathonId: hackathon.id }),
      submit: true,
      openSidebar: true,
    });
  }

  async function copyPacket() {
    const md = exportQuery.data?.markdown;
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Submission packet copied");
    } catch {
      toast.error("Could not copy. Your browser blocked the clipboard.");
    }
  }

  return (
    <div className="@container w-full">
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-8 @4xl:grid-cols-[1fr_280px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Link to="/hackathons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <IconArrowLeft className="size-4" /> Hackathons
        </Link>
        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-amber-500/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{hackathon.name}</h1>
              {hackathon.prize ? <p className="text-sm text-muted-foreground">{hackathon.prize}</p> : null}
              {hackathon.url ? (
                <a href={hackathon.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Rules page <IconExternalLink className="size-3" />
                </a>
              ) : null}
              <div className="pt-2 text-xs text-muted-foreground">
                <p>Due {formatInZone(hackathon.deadlineAt, hackathon.deadlineTz)}</p>
                {localZone !== hackathon.deadlineTz ? <p>= {formatInZone(hackathon.deadlineAt, localZone)} your time</p> : null}
              </div>
            </div>
            <Countdown deadlineAt={hackathon.deadlineAt} size="lg" />
          </div>
          <div className="mt-5 space-y-2">
            <ProgressBar percent={readiness.percent} ready={readiness.ready} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {readiness.approvedCount} of {readiness.requiredCount} required items approved
                {proposed ? ` · ${proposed} agent draft${proposed === 1 ? "" : "s"} waiting for you` : ""}
              </span>
              <span className={cn("font-medium", readiness.ready ? "text-emerald-600" : "")}>
                {locked ? "Submitted" : readiness.ready ? "Ready to submit" : `${readiness.missing.length} to go`}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!locked && todo > 0 ? (
              <Button onClick={draftAll}>
                <IconSparkles className="size-4" /> Draft all with agent
              </Button>
            ) : null}
            <Button variant="outline" onClick={copyPacket} disabled={!exportQuery.data}>
              <IconClipboardCopy className="size-4" /> Copy submission packet
            </Button>
            {locked ? (
              <Button variant="ghost" onClick={() => setStatus.mutate({ id: hackathon.id, status: "building" })}>
                <IconRotate className="size-4" /> Reopen
              </Button>
            ) : (
              <Button
                variant={readiness.ready ? "default" : "outline"}
                className={readiness.ready ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}
                onClick={() => setStatus.mutate({ id: hackathon.id, status: "submitted" })}
                disabled={setStatus.isPending}
              >
                <IconSend className="size-4" /> Mark submitted
              </Button>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No checklist yet. Ask the agent to read the rules and build one.
            </p>
          ) : (
            items.map((item) => (
              <ChecklistItem key={item.id} item={item as Item} hackathonId={hackathon.id} hackathonName={hackathon.name} locked={locked} />
            ))
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3 @4xl:sticky @4xl:top-6 @4xl:self-start">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Who did what</h2>
        <ol className="relative space-y-3 border-l border-border pl-4">
          {activity.map((a) => (
            <li key={a.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[25px] flex size-[18px] items-center justify-center rounded-full ring-4 ring-background",
                  a.actor === "agent" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground",
                )}
              >
                {a.actor === "agent" ? <IconRobot className="size-3" /> : <IconUser className="size-3" />}
              </span>
              <p className="text-xs leading-snug">{a.message}</p>
              <p className="text-[11px] text-muted-foreground">
                {a.actor === "agent" ? "Agent" : "You"} · {relative(a.createdAt, now)}
              </p>
            </li>
          ))}
        </ol>
      </aside>
    </main>
    </div>
  );
}
