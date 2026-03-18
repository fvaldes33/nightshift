import { useChat } from "@ai-sdk/react";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { CheckCircleIcon, Loader2Icon, PlayIcon, RepeatIcon, XCircleIcon } from "lucide-react";
import { useChatContext } from "../chat-context";
import { trpc } from "~/lib/trpc-react";
import type { ToolPart } from "./types";

export function StartLoopTool({ part }: { part: ToolPart }) {
  const { chat, session } = useChatContext();
  const { addToolOutput } = useChat({ chat });

  const input = part.input as {
    name?: string;
    maxIterations?: number;
    filterConfig?: { labels?: string[]; assignee?: string };
  };
  const output = part.output as {
    action?: string;
    loop?: { id: string; name: string; status: string };
  } | undefined;

  const startLoop = trpc.loop.start.useMutation();

  function handleStart() {
    const toolCallId = part.toolCallId;
    if (!session.repoId || !toolCallId) return;

    startLoop.mutate(
      {
        sessionId: session.id,
        repoId: session.repoId,
        name: input.name ?? "Ralph Loop",
        branch: session.branch ?? undefined,
        worktree: session.worktreePath ?? undefined,
        maxIterations: input.maxIterations ?? 10,
        filterConfig: input.filterConfig,
      },
      {
        onSuccess: (loop) => {
          addToolOutput({
            tool: "start_loop" as const,
            toolCallId,
            output: {
              action: "started" as const,
              loop: { id: loop.id, name: loop.name, status: loop.status },
            },
          });
        },
        onError: (error) => {
          addToolOutput({
            tool: "start_loop" as const,
            toolCallId,
            state: "output-error" as const,
            errorText: error.message,
          });
        },
      },
    );
  }

  function handleSkip() {
    const toolCallId = part.toolCallId;
    if (!toolCallId) return;
    addToolOutput({
      tool: "start_loop" as const,
      toolCallId,
      output: { action: "skipped" as const },
    });
  }

  // Output state — loop was started or skipped
  if (part.state === "output-available" && output) {
    if (output.action === "skipped") {
      return (
        <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <RepeatIcon className="size-4 shrink-0" />
            <span>Loop skipped</span>
          </div>
        </div>
      );
    }

    return (
      <div className="not-prose w-full min-w-0 rounded-md border px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircleIcon className="size-4 shrink-0 text-green-500" />
          <span className="font-medium">{output.loop?.name}</span>
          <Badge variant="secondary" className="text-[10px]">
            {output.loop?.status}
          </Badge>
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

  // Input available — show confirmation card
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
            <span className="text-sm">{input.name ?? "Ralph Loop"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Max iterations</span>
            <span className="font-mono text-sm">{input.maxIterations ?? 10}</span>
          </div>
          {input.filterConfig?.labels && input.filterConfig.labels.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Labels</span>
              <div className="flex gap-1">
                {input.filterConfig.labels.map((l) => (
                  <Badge key={l} variant="outline" className="text-[10px]">
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {input.filterConfig?.assignee && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Assignee</span>
              <span className="text-sm">{input.filterConfig.assignee}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSkip}>
          Skip
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleStart}
          disabled={startLoop.isPending || !session.repoId}
        >
          {startLoop.isPending ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <PlayIcon className="size-3" />
          )}
          Start Loop
        </Button>
      </div>
    </div>
  );
}
