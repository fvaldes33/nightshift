import { Button } from "@openralph/ui/components/button";
import { Loader2Icon, PanelRightOpenIcon, SearchCodeIcon, XCircleIcon } from "lucide-react";
import { useArtifactStore } from "~/hooks/use-artifact-store";
import type { ToolPart } from "./types";

const OUTPUT_PREVIEW_LINES = 5;

export function RunExplorationTool({ part }: { part: ToolPart }) {
  const open = useArtifactStore((s) => s.open);
  const prompt = (part.input as { prompt?: string })?.prompt;
  const output = part.output as { result?: string } | undefined;
  const result = output?.result;

  const previewLines = result?.split("\n").slice(0, OUTPUT_PREVIEW_LINES).join("\n");

  return (
    <div className="not-prose w-full min-w-0 rounded-md border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <SearchCodeIcon className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">Exploration</span>
        <StatusIndicator state={part.state} />
      </div>

      {/* Prompt */}
      {prompt && (
        <div className="border-t px-3 py-2.5">
          <p className="text-muted-foreground text-xs italic leading-relaxed">{prompt}</p>
        </div>
      )}

      {/* Output preview */}
      {part.state === "output-available" && previewLines && (
        <div className="border-t">
          <div className="relative max-h-28 overflow-hidden px-3 pt-2.5">
            <pre className="text-muted-foreground whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {previewLines}
            </pre>
            <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t" />
          </div>
          <div className="px-3 pb-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 text-xs"
              onClick={() =>
                open({
                  id: part.toolCallId ?? crypto.randomUUID(),
                  title: "Exploration Results",
                  content: result!,
                })
              }
            >
              <PanelRightOpenIcon className="mr-1.5 size-3" />
              View full results
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {part.state === "output-error" && part.errorText && (
        <div className="border-t px-3 py-2.5">
          <div className="flex items-start gap-2 text-xs text-red-400">
            <XCircleIcon className="mt-0.5 size-3 shrink-0" />
            <span>{part.errorText}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ state }: { state: string }) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2Icon className="size-3 animate-spin" />
        Exploring...
      </span>
    );
  }
  if (state === "output-error") {
    return <span className="text-xs text-red-400">Failed</span>;
  }
  if (state === "output-available") {
    return <span className="text-xs text-green-500">Done</span>;
  }
  return null;
}
