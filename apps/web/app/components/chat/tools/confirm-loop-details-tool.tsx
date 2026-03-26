import { useChat } from "@ai-sdk/react";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { CheckCircleIcon, Loader2Icon, RepeatIcon, XCircleIcon, XIcon } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "~/lib/trpc-react";
import { useChatContext } from "../chat-context";
import type { AnyToolPart } from "./types";

interface LoopConfig {
  name?: string;
  maxIterations?: number;
  filterConfig?: { labels?: string[]; assignee?: string };
}

interface ParsedOutput extends LoopConfig {
  action: "pending" | "confirmed" | "rejected";
  loop?: { id: string; name: string; status: string };
}

export function ConfirmLoopDetailsTool({ part }: { part: AnyToolPart }) {
  const { chat, session } = useChatContext();
  const { addToolOutput } = useChat({ chat });
  const startLoop = trpc.loop.start.useMutation();

  const config = (part as any).input as LoopConfig;
  const rawOutput = (part as any).output;

  // Parse output — string (initial MCP echo) or object (after addToolOutput patch)
  const parsed = useMemo<ParsedOutput | null>(() => {
    if (!rawOutput) return null;
    if (typeof rawOutput === "string") {
      try {
        return JSON.parse(rawOutput);
      } catch {
        return null;
      }
    }
    return rawOutput as ParsedOutput;
  }, [rawOutput]);

  const action = parsed?.action ?? "pending";

  function handleConfirm() {
    if (!session.repoId) return;

    const toolCallId = part.toolCallId;

    startLoop.mutate(
      {
        sessionId: session.id,
        repoId: session.repoId,
        name: config.name ?? "Ralph Loop",
        maxIterations: config.maxIterations ?? 10,
        filterConfig: config.filterConfig ?? undefined,
      },
      {
        onSuccess: (loop) => {
          addToolOutput({
            tool: "mcp__openralph__confirm_loop_details" as any,
            toolCallId,
            output: {
              action: "confirmed" as const,
              name: config.name ?? "Ralph Loop",
              maxIterations: config.maxIterations ?? 10,
              filterConfig: config.filterConfig,
              loop: { id: loop.id, name: loop.name, status: loop.status },
            },
          });
        },
      },
    );
  }

  function handleReject() {
    addToolOutput({
      tool: "confirm_loop_details" as const,
      toolCallId: part.toolCallId,
      output: {
        action: "rejected" as const,
        name: config.name ?? "Ralph Loop",
        maxIterations: config.maxIterations ?? 10,
        filterConfig: config.filterConfig,
      },
    });
  }

  // Confirmed state
  if (action === "confirmed") {
    return (
      <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircleIcon className="size-4 shrink-0 text-green-500" />
          <span className="font-medium">{parsed?.loop?.name ?? config.name}</span>
          <Badge variant="secondary" className="text-[10px]">
            {parsed?.loop?.status ?? "queued"}
          </Badge>
        </div>
      </div>
    );
  }

  // Rejected state
  if (action === "rejected") {
    return (
      <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <XIcon className="size-4 shrink-0" />
          <span>Loop rejected</span>
        </div>
      </div>
    );
  }

  // Error state
  if (part.state === "output-error") {
    return (
      <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
        <div className="flex items-start gap-2 text-xs text-red-400">
          <XCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{part.errorText}</span>
        </div>
      </div>
    );
  }

  // Streaming — still building input
  if (part.state === "input-streaming") {
    return (
      <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          <span>Preparing loop...</span>
        </div>
      </div>
    );
  }

  // Pending confirmation — show card
  return (
    <div className="not-prose w-full min-w-0 rounded-md border">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <RepeatIcon className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">Start Loop</span>
      </div>

      <div className="border-t px-3 py-2.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Name</span>
            <span className="text-sm">{config.name ?? "Ralph Loop"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Max iterations</span>
            <span className="font-mono text-sm">{config.maxIterations ?? 10}</span>
          </div>
          {config.filterConfig?.labels && config.filterConfig.labels.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Labels</span>
              <div className="flex gap-1">
                {config.filterConfig.labels.map((l) => (
                  <Badge key={l} variant="outline" className="text-[10px]">
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {config.filterConfig?.assignee && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Assignee</span>
              <span className="text-sm">{config.filterConfig.assignee}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReject}>
          Reject
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleConfirm}
          disabled={startLoop.isPending || !session.repoId}
        >
          {startLoop.isPending ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <RepeatIcon className="size-3" />
          )}
          Start Loop
        </Button>
      </div>
    </div>
  );
}
