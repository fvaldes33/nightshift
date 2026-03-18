import type { LoopEvent } from "@openralph/db/models/loop-event.model";
import { MarkdownContent } from "@openralph/ui/ai/markdown-content";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@openralph/ui/ai/reasoning";
import { Badge } from "@openralph/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openralph/ui/components/collapsible";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  Loader2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";

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
    case "tool_call":
      return <ToolCallEvent payload={payload} pairedResult={event.pairedResult} />;
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

// ── Tool Call (with paired result) ────────────────────────────────────────────

function ToolCallEvent({
  payload,
  pairedResult,
}: {
  payload: Record<string, unknown>;
  pairedResult?: Record<string, unknown>;
}) {
  const name = (payload.name as string) ?? "unknown";
  const input = payload.input;
  const isError = pairedResult?.isError === true;
  const hasResult = !!pairedResult;

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
        <WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{name}</span>
        <div className="flex-1" />
        {hasResult ? (
          isError ? (
            <XCircleIcon className="size-3.5 text-destructive" />
          ) : (
            <CheckCircleIcon className="size-3.5 text-green-600" />
          )
        ) : (
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-3 py-2.5">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Input
          </span>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-2.5 font-mono text-xs leading-relaxed">
            {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
          </pre>
        </div>
        {pairedResult && (
          <div className="border-t px-3 py-2.5">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isError ? "Error" : "Output"}
            </span>
            <pre
              className={`max-h-48 overflow-auto rounded-md p-2.5 font-mono text-xs leading-relaxed ${
                isError ? "bg-destructive/10 text-destructive" : "bg-muted/50"
              }`}
            >
              {(pairedResult.content as string) ?? JSON.stringify(pairedResult, null, 2)}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
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
