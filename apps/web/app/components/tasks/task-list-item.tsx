import type { TaskListItem as TaskListItemType } from "@openralph/backend/types/task.types";
import { Link } from "react-router";
import { statusConfig } from "~/components/task-columns";

interface TaskListItemProps {
  task: TaskListItemType;
  to: string;
}

export function TaskListItem({ task, to }: TaskListItemProps) {
  const config = statusConfig[task.status] ?? statusConfig.backlog;

  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg py-2.5 sm:px-3 hover:bg-accent/50 transition-colors"
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${config.dot}`}
        aria-label={config.label}
      />
      <span className="flex-1 text-sm">{task.title}</span>
      <span className="mt-0.5 text-[11px] text-muted-foreground/70 shrink-0 sm:hidden">
        {config.label}
      </span>
    </Link>
  );
}
