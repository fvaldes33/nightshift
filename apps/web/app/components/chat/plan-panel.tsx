import { MarkdownContent } from "@openralph/ui/ai/markdown-content";
import { XIcon } from "lucide-react";
import { usePlanStore } from "~/hooks/use-plan-store";

export function PlanPanel() {
  const { plan, close } = usePlanStore();

  if (!plan) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{plan.title}</h2>
        <button
          type="button"
          onClick={close}
          className="text-muted-foreground hover:text-foreground rounded-sm p-1"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <MarkdownContent>{plan.content}</MarkdownContent>
      </div>
    </div>
  );
}
