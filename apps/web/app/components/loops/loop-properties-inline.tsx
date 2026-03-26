import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
import { Badge } from "@openralph/ui/components/badge";
import { Progress } from "@openralph/ui/components/progress";
import {
  CalendarIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  RepeatIcon,
} from "lucide-react";
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

export function LoopPropertiesInline({ loop, repoId }: { loop: LoopGetOutput; repoId: string }) {
  const progress = loop.maxIterations > 0
    ? (loop.currentIteration / loop.maxIterations) * 100
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Status + iterations row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="gap-1.5 text-[11px]">
          <span className={`size-1.5 shrink-0 rounded-full ${statusColor[loop.status] ?? "bg-muted-foreground"}`} />
          {statusLabel[loop.status] ?? loop.status}
        </Badge>
        <Badge variant="secondary" className="gap-1 text-[11px] font-mono">
          <RepeatIcon className="size-2.5" />
          {loop.currentIteration}/{loop.maxIterations}
        </Badge>
        {loop.session?.branch && (
          <Badge variant="secondary" className="gap-1 text-[11px] font-mono">
            <GitBranchIcon className="size-2.5" />
            {loop.session.branch}
          </Badge>
        )}
        {loop.session?.prUrl && (
          <a href={loop.session.prUrl} target="_blank" rel="noopener noreferrer">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <GitPullRequestIcon className="size-2.5" />
              #{loop.session.prNumber}
            </Badge>
          </a>
        )}
        {loop.session && (
          <Link to={`/repos/${repoId}/sessions/${loop.session.id}`}>
            <Badge variant="outline" className="text-[11px]">
              {loop.session.title}
            </Badge>
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1" />

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarIcon className="size-2.5" />
          {new Date(loop.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
