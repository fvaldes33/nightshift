import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
import { Badge } from "@openralph/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@openralph/ui/components/tooltip";
import {
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

export function LoopProperties({ loop }: { loop: LoopGetOutput }) {
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
        <span className="font-mono text-xs text-muted-foreground">
          {loop.branch ?? "\u2014"}
        </span>
      </TaskPropertyRow>

      <TaskPropertyRow icon={<GitPullRequestIcon />} label="PR">
        {loop.prUrl ? (
          <a
            href={loop.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline text-xs"
          >
            #{loop.prNumber}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        )}
      </TaskPropertyRow>

      <TaskPropertyRow icon={<FolderIcon />} label="Worktree">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block max-w-[120px] truncate font-mono text-xs text-muted-foreground">
              {loop.worktree ?? "\u2014"}
            </span>
          </TooltipTrigger>
          {loop.worktree && (
            <TooltipContent side="bottom">{loop.worktree}</TooltipContent>
          )}
        </Tooltip>
      </TaskPropertyRow>

      {"task" in loop && loop.task ? (
        <TaskPropertyRow icon={<ListTodoIcon />} label="Task">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/tasks/${loop.task.id}`}
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
                to={`/sessions/${loop.session.id}`}
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
          {formatRelativeTime(new Date(loop.updatedAt))}
        </span>
      </TaskPropertyRow>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
