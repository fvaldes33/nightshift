import type { LoopEvent } from "@openralph/db/models/loop-event.model";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@openralph/ui/components/accordion";
import { Badge } from "@openralph/ui/components/badge";
import { CheckCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { LoopEventItem, LoopToolCallGroup, type ProcessedEvent } from "./loop-event";

interface LoopIterationProps {
  iteration: number;
  events: LoopEvent[];
  isActive: boolean;
}

export function LoopIteration({ iteration, events, isActive }: LoopIterationProps) {
  const { processedEvents, resultEvent } = useMemo(() => {
    // Build tool_result lookup by toolUseId
    const resultMap = new Map<string, LoopEvent>();
    for (const e of events) {
      if (e.eventType === "tool_result") {
        const toolUseId = (e.payload as Record<string, unknown>).toolUseId as string | undefined;
        if (toolUseId) resultMap.set(toolUseId, e);
      }
    }

    // Filter out standalone tool_results, pair them with tool_calls
    const processed: ProcessedEvent[] = [];
    let result: LoopEvent | undefined;

    for (const e of events) {
      if (e.eventType === "tool_result") continue; // skip — merged into tool_call

      if (e.eventType === "result") {
        result = e;
        processed.push(e);
        continue;
      }

      if (e.eventType === "tool_call") {
        const toolUseId = (e.payload as Record<string, unknown>).toolUseId as string | undefined;
        const paired = toolUseId ? resultMap.get(toolUseId) : undefined;
        processed.push({
          ...e,
          pairedResult: paired?.payload as Record<string, unknown> | undefined,
        });
        continue;
      }

      processed.push(e);
    }

    return { processedEvents: processed, resultEvent: result };
  }, [events]);

  // Group consecutive tool_call events into segments
  type EventSegment =
    | { kind: "single"; event: ProcessedEvent }
    | { kind: "tool-group"; events: ProcessedEvent[] };

  const segments = useMemo(() => {
    const result: EventSegment[] = [];
    let currentGroup: ProcessedEvent[] = [];

    function flushGroup() {
      if (currentGroup.length > 0) {
        result.push({ kind: "tool-group", events: currentGroup });
        currentGroup = [];
      }
    }

    for (const event of processedEvents) {
      if (event.eventType === "tool_call") {
        currentGroup.push(event);
      } else {
        flushGroup();
        result.push({ kind: "single", event });
      }
    }
    flushGroup();

    return result;
  }, [processedEvents]);

  const resultPayload = resultEvent?.payload as
    | { usage?: { inputTokens?: number; outputTokens?: number }; costUsd?: number }
    | undefined;

  return (
    <AccordionItem value={`iter-${iteration}`} className="border-b border-border/50">
      <AccordionTrigger className="px-0 py-3 hover:no-underline">
        <div className="flex items-center gap-3">
          {isActive ? (
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-green-500" />
          ) : (
            <CheckCircleIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Iteration {iteration}</span>

          {resultPayload?.usage && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatTokens(resultPayload.usage.inputTokens ?? 0)} in /{" "}
              {formatTokens(resultPayload.usage.outputTokens ?? 0)} out
            </span>
          )}

          <Badge variant="secondary" className="ml-auto text-[10px]">
            {events.length} events
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-0">
        <div className="space-y-3 pl-5 border-l border-border/50 ml-[5px]">
          {segments.map((segment, i) => {
            if (segment.kind === "tool-group") {
              return (
                <LoopToolCallGroup
                  key={segment.events[0].id}
                  events={segment.events}
                />
              );
            }
            return (
              <LoopEventItem key={segment.event.id} event={segment.event} />
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
