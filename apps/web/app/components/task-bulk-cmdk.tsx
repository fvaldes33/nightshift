import { taskStatusEnum } from "@openralph/db/models/task.model";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@openralph/ui/components/command";
import { Input } from "@openralph/ui/components/input";
import { toast } from "@openralph/ui/components/sonner";
import type { Table } from "@tanstack/react-table";
import { AlertTriangle, ArrowLeft, RefreshCw, Signal, Trash2, User } from "lucide-react";
import { useState } from "react";
import { trpc } from "~/lib/trpc-react";

const statusConfig: Record<string, { label: string; dot: string }> = {
  backlog: { label: "Backlog", dot: "bg-muted-foreground" },
  todo: { label: "Todo", dot: "bg-blue-500" },
  in_progress: { label: "In Progress", dot: "bg-yellow-500" },
  done: { label: "Done", dot: "bg-green-500" },
  canceled: { label: "Canceled", dot: "bg-red-500" },
};

const priorityConfig: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

type View = "root" | "status" | "priority" | "assignee" | "confirmDelete";

interface TaskBulkCmdkProps<TData extends { id: string }> {
  table: Table<TData>;
}

function getSelectedIds<TData extends { id: string }>(table: Table<TData>) {
  return table.getSelectedRowModel().rows.map((r) => r.original.id);
}

export function TaskBulkCmdk<TData extends { id: string }>({ table }: TaskBulkCmdkProps<TData>) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("root");
  const [assigneeInput, setAssigneeInput] = useState("");
  const utils = trpc.useUtils();

  const selectedCount = table.getSelectedRowModel().rows.length;

  function handleSuccess(message: string) {
    setOpen(false);
    setView("root");
    setAssigneeInput("");
    toast.success(message);
    utils.task.list.invalidate();
    table.toggleAllRowsSelected(false);
  }

  const bulkUpdate = trpc.task.bulkUpdate.useMutation({
    onSuccess: (data) => handleSuccess(`Updated ${data.updated} tasks`),
  });

  const bulkDelete = trpc.task.bulkDelete.useMutation({
    onSuccess: (data) => handleSuccess(`Deleted ${data.deleted} tasks`),
  });

  const isPending = bulkUpdate.isPending || bulkDelete.isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("root");
      setAssigneeInput("");
    }
  }

  function handleStatusSelect(status: (typeof taskStatusEnum.enumValues)[number]) {
    bulkUpdate.mutate({ ids: getSelectedIds(table), status });
  }

  function handlePrioritySelect(priority: number) {
    bulkUpdate.mutate({ ids: getSelectedIds(table), priority });
  }

  function handleAssigneeSubmit() {
    const value = assigneeInput.trim();
    bulkUpdate.mutate({ ids: getSelectedIds(table), assignee: value || null });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        Actions
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Bulk Actions"
        description={`Apply action to ${selectedCount} selected tasks`}
        shouldFilter={view === "root"}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          {view !== "root" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => {
                setView("root");
                setAssigneeInput("");
              }}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          )}
          <Badge variant="secondary" className="text-xs tabular-nums">
            {selectedCount} {selectedCount === 1 ? "task" : "tasks"}
          </Badge>
        </div>

        {view === "root" && (
          <>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No commands found.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => setView("status")} disabled={isPending}>
                  <RefreshCw className="size-4" />
                  Change status...
                </CommandItem>
                <CommandItem onSelect={() => setView("priority")} disabled={isPending}>
                  <Signal className="size-4" />
                  Change priority...
                </CommandItem>
                <CommandItem onSelect={() => setView("assignee")} disabled={isPending}>
                  <User className="size-4" />
                  Change assignee...
                </CommandItem>
                <CommandSeparator />
                <CommandItem
                  onSelect={() => setView("confirmDelete")}
                  disabled={isPending}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete tasks...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </>
        )}

        {view === "status" && (
          <>
            <CommandInput placeholder="Search statuses..." />
            <CommandList>
              <CommandEmpty>No statuses found.</CommandEmpty>
              <CommandGroup heading="Task Status">
                {taskStatusEnum.enumValues.map((status) => (
                  <CommandItem
                    key={status}
                    onSelect={() => handleStatusSelect(status)}
                    disabled={isPending}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${statusConfig[status]?.dot ?? "bg-muted-foreground"}`}
                    />
                    {statusConfig[status]?.label ?? status}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}

        {view === "priority" && (
          <>
            <CommandInput placeholder="Search priorities..." />
            <CommandList>
              <CommandEmpty>No priorities found.</CommandEmpty>
              <CommandGroup heading="Priority">
                {([1, 2, 3, 4] as const).map((p) => (
                  <CommandItem
                    key={p}
                    onSelect={() => handlePrioritySelect(p)}
                    disabled={isPending}
                  >
                    {priorityConfig[p]}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}

        {view === "assignee" && (
          <div className="flex flex-col gap-3 p-4">
            <label className="text-muted-foreground text-xs font-medium">
              New assignee for {selectedCount} {selectedCount === 1 ? "task" : "tasks"}
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Assignee name (leave empty to unassign)"
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAssigneeSubmit();
                  }
                }}
                className="text-sm"
                autoFocus
              />
              <Button
                size="sm"
                className="h-9"
                onClick={handleAssigneeSubmit}
                disabled={isPending}
              >
                {isPending ? "Updating..." : "Apply"}
              </Button>
            </div>
          </div>
        )}

        {view === "confirmDelete" && (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm">
              Permanently delete{" "}
              <strong>
                {selectedCount} {selectedCount === 1 ? "task" : "tasks"}
              </strong>
              ?
            </p>
            <div className="text-destructive flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>This action cannot be undone.</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView("root")} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkDelete.mutate({ ids: getSelectedIds(table) })}
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </CommandDialog>
    </>
  );
}
