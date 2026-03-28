import type { LoopEvent } from "@openralph/db/models/loop-event.model";
import {
  CompactTool,
  CompactToolContent,
  CompactToolDetail,
  CompactToolEntry,
  CompactToolIcon,
  CompactToolName,
  CompactToolStatus,
} from "@openralph/ui/ai/compact-tool";
import { MarkdownContent } from "@openralph/ui/ai/markdown-content";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@openralph/ui/ai/reasoning";
import { ToolInput, ToolOutput } from "@openralph/ui/ai/tool";
import type { ToolPart as UIToolPart } from "@openralph/ui/ai/tool";
import { Badge } from "@openralph/ui/components/badge";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import {
  descriptionExtractors,
  getDisplayName,
  toolIcons,
} from "../chat/tools/compact-tool-renderers";

// Event with optional paired tool result (attached by LoopIteration)
export type ProcessedEvent = LoopEvent & {
  pairedResult?: Record<string, unknown>;
};

export function LoopEventItem({ event }: { event: ProcessedEvent }) {
  const payload = event.payload as Record<string, unknown>;

  switch (event.eventType) {
    case "init":
      return <InitEvent payload={payload} />;
    case "assistant":
      return <AssistantEvent payload={payload} />;
    case "thinking":
      return <ThinkingEvent payload={payload} />;
    case "result":
      return <ResultEvent payload={payload} />;
    default:
      return null;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function InitEvent({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="font-mono text-[10px]">
        {(payload.model as string) ?? "unknown"}
      </Badge>
      <span>Session initialized</span>
    </div>
  );
}

// ── Assistant ─────────────────────────────────────────────────────────────────

function AssistantEvent({ payload }: { payload: Record<string, unknown> }) {
  const text = payload.text as string;
  if (!text) return null;
  return (
    <div className="text-sm">
      <MarkdownContent>{text}</MarkdownContent>
    </div>
  );
}

// ── Thinking ──────────────────────────────────────────────────────────────────

function ThinkingEvent({ payload }: { payload: Record<string, unknown> }) {
  const text = payload.text as string;
  if (!text) return null;
  return (
    <Reasoning>
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  );
}

// ── Tool Call (compact) ──────────────────────────────────────────────────────

function resolveToolState(
  pairedResult?: Record<string, unknown>,
): UIToolPart["state"] {
  if (!pairedResult) return "input-available";
  return pairedResult.isError ? "output-error" : "output-available";
}

export function LoopCompactTool({ event }: { event: ProcessedEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const name = (payload.name as string) ?? "unknown";
  const input = payload.input as Record<string, unknown> | undefined;
  const Icon = toolIcons.get(name);
  const label = getDisplayName(name);
  const extractor = descriptionExtractors.get(name);
  const description = extractor && input ? extractor(input) : "";
  const state = resolveToolState(event.pairedResult);

  const isError = event.pairedResult?.isError === true;
  const resultContent = event.pairedResult
    ? (event.pairedResult.content as string | undefined) ??
      JSON.stringify(event.pairedResult)
    : undefined;

  return (
    <CompactTool>
      <CompactToolEntry>
        <CompactToolIcon>{Icon && <Icon />}</CompactToolIcon>
        {description ? (
          <CompactToolDetail>{description}</CompactToolDetail>
        ) : (
          <CompactToolName>{label}</CompactToolName>
        )}
        <CompactToolStatus state={state} />
      </CompactToolEntry>
      <CompactToolContent>
        <ToolInput input={input} />
        <ToolOutput
          output={isError ? undefined : resultContent}
          errorText={isError ? resultContent : undefined}
        />
      </CompactToolContent>
    </CompactTool>
  );
}

// ── Tool Call Group ──────────────────────────────────────────────────────────

const VISIBLE_THRESHOLD = 6;
const HEAD_COUNT = 3;
const TAIL_COUNT = 3;

export function LoopToolCallGroup({ events }: { events: ProcessedEvent[] }) {
  const [expanded, setExpanded] = useState(false);

  if (events.length <= VISIBLE_THRESHOLD) {
    return (
      <div className="divide-y divide-border/50 rounded-md border">
        {events.map((event) => (
          <LoopCompactTool key={event.id} event={event} />
        ))}
      </div>
    );
  }

  const head = events.slice(0, HEAD_COUNT);
  const middle = events.slice(HEAD_COUNT, events.length - TAIL_COUNT);
  const tail = events.slice(events.length - TAIL_COUNT);
  const hiddenCount = middle.length;

  return (
    <div className="divide-y divide-border/50 rounded-md border">
      {head.map((event) => (
        <LoopCompactTool key={event.id} event={event} />
      ))}

      {expanded &&
        middle.map((event) => (
          <LoopCompactTool key={event.id} event={event} />
        ))}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-2 py-1 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <span className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
        <span className="flex items-center gap-1">
          {expanded ? "collapse" : `${hiddenCount} more tools`}
          {expanded ? (
            <ChevronUpIcon className="size-3" />
          ) : (
            <ChevronDownIcon className="size-3" />
          )}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
      </button>

      {tail.map((event) => (
        <LoopCompactTool key={event.id} event={event} />
      ))}
    </div>
  );
}

// ── Result ────────────────────────────────────────────────────────────────────

function ResultEvent({ payload }: { payload: Record<string, unknown> }) {
  const text = payload.text as string;
  const usage = payload.usage as
    | { inputTokens?: number; outputTokens?: number; cachedTokens?: number }
    | undefined;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
      {text && (
        <div className="text-sm">
          <MarkdownContent>{text}</MarkdownContent>
        </div>
      )}
      {usage && (
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          {usage.inputTokens != null && <span>{formatTokens(usage.inputTokens)} input</span>}
          {usage.outputTokens != null && <span>{formatTokens(usage.outputTokens)} output</span>}
          {(usage.cachedTokens ?? 0) > 0 && <span>{formatTokens(usage.cachedTokens!)} cached</span>}
          {typeof payload.costUsd === "number" && <span>${payload.costUsd.toFixed(4)}</span>}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
