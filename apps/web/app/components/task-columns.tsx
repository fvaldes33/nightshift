import type { TaskListItem } from "@openralph/backend/types/task.types";
import { Badge } from "@openralph/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

// ── Config ────────────────────────────────────────────────────────────────────

export const statusConfig: Record<string, { label: string; dot: string }> = {
  backlog: { label: "Backlog", dot: "bg-muted-foreground" },
  todo: { label: "Todo", dot: "bg-blue-500" },
  in_progress: { label: "In Progress", dot: "bg-yellow-500" },
  done: { label: "Done", dot: "bg-green-500" },
  canceled: { label: "Canceled", dot: "bg-red-500" },
};

export const priorityConfig: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

// ── Columns ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.backlog;
  return (
    <Badge variant="secondary" className="gap-1.5 text-[10px]">
      <span className={`size-1.5 shrink-0 rounded-full ${config.dot}`} aria-hidden />
      {config.label}
    </Badge>
  );
}

export const taskColumns: ColumnDef<TaskListItem>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ getValue }) => {
      const p = getValue<number>();
      return <span className="text-muted-foreground text-xs">{priorityConfig[p] ?? p}</span>;
    },
  },
  {
    accessorKey: "assignee",
    header: "Assignee",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return <span className="text-muted-foreground text-xs">&mdash;</span>;
      return <span className="text-xs">{v}</span>;
    },
  },
  {
    accessorKey: "labels",
    header: "Labels",
    enableSorting: false,
    cell: ({ getValue }) => {
      const labels = getValue<string[]>();
      if (labels.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
              {label}
            </Badge>
          ))}
        </div>
      );
    },
  },
];
