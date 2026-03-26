import { Button } from "@openralph/ui/components/button";
import { FileTextIcon, Loader2Icon, PanelRightOpenIcon, XCircleIcon } from "lucide-react";
import { usePlanStore } from "~/hooks/use-plan-store";
import type { AnyToolPart } from "./types";

export function PlanWriteTool({ part }: { part: AnyToolPart }) {
  const planOpen = usePlanStore((s) => s.open);
  const input = part.input as { file_path?: string; content?: string } | undefined;
  const filePath = input?.file_path ?? "";
  const title = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Plan";
  const toolName = part.type === "dynamic-tool" ? part.toolName : part.type.replace("tool-", "");
  const isRead = toolName === "Read";

  // For Write: content is in input.content
  // For Read: content is in output (the file contents returned by the tool)
  const planContent = isRead
    ? (typeof part.output === "string" ? part.output : undefined)
    : input?.content;

  return (
    <div className="not-prose w-full min-w-0 rounded-md border">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">{title}</span>
        <StatusIndicator state={part.state} isRead={isRead} />
      </div>

      {part.state === "output-available" && planContent && (
        <div className="border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-7 text-xs"
            onClick={() =>
              planOpen({
                filePath,
                title,
                content: planContent,
              })
            }
          >
            <PanelRightOpenIcon className="mr-1.5 size-3" />
            View plan
          </Button>
        </div>
      )}

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

function StatusIndicator({ state, isRead }: { state: string; isRead: boolean }) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2Icon className="size-3 animate-spin" />
        {isRead ? "Reading..." : "Writing..."}
      </span>
    );
  }
  if (state === "output-error") {
    return <span className="text-xs text-red-400">Failed</span>;
  }
  if (state === "output-available") {
    return <span className="text-muted-foreground text-xs">{isRead ? "Loaded" : "Saved"}</span>;
  }
  return null;
}
