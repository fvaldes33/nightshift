import type { TaskGetOutput } from "@openralph/backend/types/task.types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openralph/ui/components/collapsible";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { statusConfig, priorityConfig } from "~/components/task-columns";
import { trpc } from "~/lib/trpc-react";

type Subtask = TaskGetOutput["subtasks"][number];

interface TaskSubtasksProps {
  taskId: string;
  subtasks: Subtask[];
}

export function TaskSubtasks({ taskId, subtasks }: TaskSubtasksProps) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      setNewTitle("");
      setAdding(false);
    },
  });

  function handleSubmit() {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    createTask.mutate({
      parentId: taskId,
      title: trimmed,
      status: "todo",
      priority: 3,
      labels: [],
    });
  }

  // Don't render the section at all if no subtasks and not adding
  if (subtasks.length === 0 && !adding) {
    return (
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
        onClick={() => setAdding(true)}
      >
        <PlusIcon className="size-3" />
        Add sub-issue
      </button>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1">
        <ChevronRightIcon
          className={`text-muted-foreground size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="text-muted-foreground text-xs font-medium">Sub-issues</span>
        <span className="text-muted-foreground/60 text-[10px]">{subtasks.length}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-px">
          {subtasks.map((sub) => {
            const sc = statusConfig[sub.status] ?? statusConfig.backlog;
            return (
              <Link
                key={sub.id}
                to={`/tasks/${sub.id}`}
                className="hover:bg-accent/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className={`size-2 shrink-0 rounded-full ${sc.dot}`} />
                <span className="flex-1 truncate text-sm">{sub.title}</span>
                <span className="text-muted-foreground/60 text-[10px]">
                  {priorityConfig[sub.priority] ?? ""}
                </span>
              </Link>
            );
          })}

          {adding ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <PlusIcon className="text-muted-foreground size-3" />
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewTitle("");
                  }
                }}
                placeholder="Sub-issue title"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                autoFocus
                disabled={createTask.isPending}
              />
            </div>
          ) : (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors"
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="size-3" />
              Add sub-issue
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
