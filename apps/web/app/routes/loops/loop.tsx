import type { LoopEvent } from "@openralph/db/models/loop-event.model";
import { Accordion } from "@openralph/ui/components/accordion";
import { RepeatIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { LoopHeader } from "~/components/loops/loop-header";
import { LoopIteration } from "~/components/loops/loop-iteration";
import { LoopProperties } from "~/components/loops/loop-properties";
import { LoopPropertiesInline } from "~/components/loops/loop-properties-inline";
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
    iterations.length > 0 ? [`iter-${iterations[iterations.length - 1].iteration}`] : [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <LoopHeader loop={loop} repoId={repoId} onDelete={handleDelete} />

      <div className="flex min-h-0 flex-1">
        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-12 sm:py-6">
            {/* Title */}
            <h1 className="text-lg font-semibold sm:hidden">{loop.name}</h1>

            {/* Mobile: compact pill row */}
            <div className="sm:hidden">
              <LoopPropertiesInline loop={loop} repoId={repoId} />
            </div>

            {/* Prompt */}
            {loop.prompt && (
              <div className="border-border/50 bg-muted/30 rounded-lg border px-4 py-3">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">Prompt</span>
                <p className="whitespace-pre-wrap text-sm">{loop.prompt}</p>
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
                    isActive={loop.status === "running" && iteration === loop.currentIteration}
                  />
                ))}
              </Accordion>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RepeatIcon className="text-muted-foreground/50 mb-3 size-8" />
                <p className="text-muted-foreground text-sm">
                  {loop.status === "queued"
                    ? "Loop is queued. Events will appear when it starts running."
                    : "No events yet."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: sidebar */}
        <div className="border-border/50 hidden w-[280px] shrink-0 overflow-y-auto border-l sm:block">
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
