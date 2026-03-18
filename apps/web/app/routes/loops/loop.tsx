import type { LoopEvent } from "@openralph/db/models/loop-event.model";
import { Accordion } from "@openralph/ui/components/accordion";
import { RepeatIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { LoopHeader } from "~/components/loops/loop-header";
import { LoopIteration } from "~/components/loops/loop-iteration";
import { LoopProperties } from "~/components/loops/loop-properties";
import { useLoops } from "~/hooks/use-collection";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Loop \u2014 nightshift" }];
}

export default function Loop() {
  const params = useParams();
  const navigate = useNavigate();
  const repoId = params.repoId!;
  const { collection: loopCollection } = useLoops({ repoId });

  const { data: loop, isLoading } = trpc.loop.get.useQuery({ id: params.loopId! });
  const { data: events } = trpc.loop.events.useQuery(
    { loopId: params.loopId! },
    { enabled: !!params.loopId },
  );

  const iterations = useMemo(() => groupEventsByIteration(events ?? []), [events]);

  if (isLoading || !loop) return null;

  function handleDelete() {
    loopCollection.delete(loop!.id);
    navigate(`/repos/${repoId}/loops`);
  }

  // Default open: the latest / currently running iteration
  const defaultOpen =
    iterations.length > 0
      ? [`iter-${iterations[iterations.length - 1].iteration}`]
      : [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <LoopHeader loop={loop} repoId={repoId} onDelete={handleDelete} />

      <div className="flex min-h-0 flex-1">
        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-12 py-6">
            {/* Prompt */}
            {loop.prompt && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  Prompt
                </span>
                <p className="text-sm whitespace-pre-wrap">{loop.prompt}</p>
              </div>
            )}

            {/* Iterations */}
            {iterations.length > 0 ? (
              <Accordion type="multiple" defaultValue={defaultOpen}>
                {iterations.map(({ iteration, events: iterEvents }) => (
                  <LoopIteration
                    key={iteration}
                    iteration={iteration}
                    events={iterEvents}
                    isActive={
                      loop.status === "running" && iteration === loop.currentIteration
                    }
                  />
                ))}
              </Accordion>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RepeatIcon className="size-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {loop.status === "queued"
                    ? "Loop is queued. Events will appear when it starts running."
                    : "No events yet."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="border-border/50 w-[280px] shrink-0 border-l overflow-y-auto">
          <LoopProperties loop={loop} repoId={repoId} />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupEventsByIteration(events: LoopEvent[]) {
  const map = new Map<number, LoopEvent[]>();
  for (const event of events) {
    const list = map.get(event.iteration) ?? [];
    list.push(event);
    map.set(event.iteration, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([iteration, events]) => ({ iteration, events }));
}
