import type { LoopListItem as LoopListItemType } from "@openralph/backend/types/loop.types";
import { Progress } from "@openralph/ui/components/progress";
import { Link } from "react-router";

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

const statusLabel: Record<string, string> = {
  running: "Running",
  queued: "Queued",
  complete: "Complete",
  failed: "Failed",
};

interface LoopListItemProps {
  loop: LoopListItemType;
  to: string;
}

export function LoopListItem({ loop, to }: LoopListItemProps) {
  const progress = loop.maxIterations > 0 ? (loop.currentIteration / loop.maxIterations) * 100 : 0;

  return (
    <Link
      to={to}
      className="hover:bg-accent/50 group flex flex-col gap-1 rounded-lg py-2.5 transition-colors sm:px-3"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`size-2 shrink-0 rounded-full ${statusColor[loop.status] ?? "bg-muted-foreground"}`}
        />
        <span className="flex-1 text-sm">{loop.name}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 pl-[18px]">
        <span className="text-muted-foreground/70 shrink-0 text-[11px]">
          {statusLabel[loop.status] ?? loop.status}
        </span>
        <span className="text-muted-foreground/30 shrink-0">/</span>
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[11px]">
          {loop.currentIteration}/{loop.maxIterations}
        </span>
        <Progress value={progress} className="ml-auto h-1 w-12 shrink-0" />
      </div>
    </Link>
  );
}
