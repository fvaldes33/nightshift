import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
import { formatRelativeTime } from "@openralph/common/date-format";
import { Badge } from "@openralph/ui/components/badge";
import { Clipboard } from "@openralph/ui/components/clipboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@openralph/ui/components/tooltip";
import { Button } from "@openralph/ui/components/button";
import {
  ArrowRightIcon,
  CalendarIcon,
  CircleDotIcon,
  ClockIcon,
  FolderGit2Icon,
  FolderIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  ListTodoIcon,
  MessageSquareIcon,
  RepeatIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import { Link } from "react-router";
import { TaskPropertyRow } from "~/components/tasks/task-property-row";

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

export function LoopProperties({ loop, repoId }: { loop: LoopGetOutput; repoId: string }) {
  const filterConfig = loop.filterConfig as
    | { labels?: string[]; assignee?: string }
    | null
    | undefined;

  return (
    <div className="space-y-1 px-2 py-4">
      <TaskPropertyRow icon={<CircleDotIcon />} label="Status">
        <span className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${statusColor[loop.status] ?? "bg-muted-foreground"}`}
          />
          <span className="text-xs capitalize">{loop.status}</span>
        </span>
      </TaskPropertyRow>

      <TaskPropertyRow icon={<RepeatIcon />} label="Iterations">
        <span className="font-mono text-xs">
          {loop.currentIteration} / {loop.maxIterations}
        </span>
      </TaskPropertyRow>

      <TaskPropertyRow icon={<GitBranchIcon />} label="Branch">
        {loop.session?.branch ? (
          <Clipboard value={loop.session.branch} className="font-mono text-xs text-muted-foreground">
            {loop.session.branch}
          </Clipboard>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        )}
      </TaskPropertyRow>

      <TaskPropertyRow icon={<GitPullRequestIcon />} label="PR">
        {loop.session?.prUrl ? (
          <Clipboard value={loop.session.prUrl} className="text-xs">
            <a
              href={loop.session.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              #{loop.session.prNumber}
            </a>
          </Clipboard>
        ) : loop.status === "complete" && loop.session ? (
          <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px]" asChild>
            <Link to={`/repos/${repoId}/sessions/${loop.session.id}`}>
              Create PR
              <ArrowRightIcon className="size-2.5" />
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        )}
      </TaskPropertyRow>

      <TaskPropertyRow icon={<FolderIcon />} label="Worktree">
        {loop.session?.worktreePath ? (
          <Clipboard value={loop.session.worktreePath} className="font-mono text-xs text-muted-foreground">
            {loop.session.worktreePath}
          </Clipboard>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        )}
      </TaskPropertyRow>

      {"task" in loop && loop.task ? (
        <TaskPropertyRow icon={<ListTodoIcon />} label="Task">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/repos/${repoId}/tasks/${loop.task.id}`}
                className="text-foreground hover:underline block max-w-[120px] truncate text-xs"
              >
                {loop.task.title}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">{loop.task.title}</TooltipContent>
          </Tooltip>
        </TaskPropertyRow>
      ) : (
        <TaskPropertyRow icon={<ListTodoIcon />} label="Task">
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        </TaskPropertyRow>
      )}

      {"session" in loop && loop.session ? (
        <TaskPropertyRow icon={<MessageSquareIcon />} label="Session">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/repos/${repoId}/sessions/${loop.session.id}`}
                className="text-foreground hover:underline block max-w-[120px] truncate text-xs"
              >
                {loop.session.title}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">{loop.session.title}</TooltipContent>
          </Tooltip>
        </TaskPropertyRow>
      ) : (
        <TaskPropertyRow icon={<MessageSquareIcon />} label="Session">
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        </TaskPropertyRow>
      )}

      {loop.repo && (
        <TaskPropertyRow icon={<FolderGit2Icon />} label="Repo">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/repos/${loop.repo.id}`}
                className="text-foreground hover:underline block max-w-[120px] truncate text-xs"
              >
                {loop.repo.owner}/{loop.repo.name}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {loop.repo.owner}/{loop.repo.name}
            </TooltipContent>
          </Tooltip>
        </TaskPropertyRow>
      )}

      {filterConfig?.labels && filterConfig.labels.length > 0 && (
        <TaskPropertyRow icon={<TagIcon />} label="Labels">
          <span className="flex flex-wrap gap-1">
            {filterConfig.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </span>
        </TaskPropertyRow>
      )}

      {filterConfig?.assignee && (
        <TaskPropertyRow icon={<UserIcon />} label="Assignee">
          <span className="text-xs">{filterConfig.assignee}</span>
        </TaskPropertyRow>
      )}

      <TaskPropertyRow icon={<CalendarIcon />} label="Created">
        <span className="text-muted-foreground text-xs">
          {new Date(loop.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </TaskPropertyRow>

      <TaskPropertyRow icon={<ClockIcon />} label="Updated">
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(loop.updatedAt)}
        </span>
      </TaskPropertyRow>
    </div>
  );
}
