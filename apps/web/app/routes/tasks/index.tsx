import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, taskStatusEnum } from "@openralph/db/models/task.model";
import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openralph/ui/components/form";
import { Input } from "@openralph/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { Textarea } from "@openralph/ui/components/textarea";
import { ListTodoIcon, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { z } from "zod";
import { AppHeader } from "~/components/app-header";
import { ListFilterMenu } from "~/components/list-filter-menu";
import { priorityConfig, statusConfig } from "~/components/task-columns";
import { TaskTable } from "~/components/task-table";
import { TaskListItem } from "~/components/tasks/task-list-item";
import { useTableParams } from "~/hooks/use-table-params";
import { trpc } from "~/lib/trpc-react";

// ── Form schema ──────────────────────────────────────────────────────────────

const createTaskSchema = insertTaskSchema.pick({
  title: true,
  description: true,
  status: true,
  priority: true,
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

export function meta() {
  return [{ title: "Tasks — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const params = useParams();
  const repoId = params.repoId!;
  const [dialogOpen, setDialogOpen] = useState(false);

  const { filters, setFilter, toggleFilter } = useTableParams({
    filterKeys: ["status", "priority", "assignee"] as const,
  });

  const { data: tasks = [] } = trpc.task.list.useQuery({
    repoId,
    status: filters.status,
    priority: filters.priority,
    assignee: filters.assignee,
  });

  const hasFilters = filters.status || filters.priority || filters.assignee;
  const isEmpty = tasks.length === 0 && !hasFilters;

  if (isEmpty) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24">
          <ListTodoIcon className="text-muted-foreground mb-4 size-12" />
          <h3 className="text-lg font-semibold">No tasks yet</h3>
          <p className="text-muted-foreground mb-4 mt-1 text-sm">
            Create your first task to get started.
          </p>
          <Button size="sm" className="h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            New task
          </Button>
        </div>
        <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repoId={repoId} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <AppHeader
          actions={
            <Button size="sm" className="h-7" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              New
            </Button>
          }
        >
          <ListFilterMenu
            className="h-7 text-xs"
            groups={[
              {
                key: "status",
                label: "Status",
                mode: "multi",
                value: filters.status,
                allLabel: "All statuses",
                options: taskStatusEnum.enumValues.map((s) => ({
                  value: s,
                  label: (
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      <span
                        className={`size-2 shrink-0 rounded-full ${statusConfig[s]?.dot ?? "bg-muted-foreground"}`}
                      />
                      {statusConfig[s]?.label ?? s}
                    </span>
                  ),
                })),
                onToggle: (value) => toggleFilter("status", value),
                onClear: () => setFilter("status", undefined),
              },
              {
                key: "priority",
                label: "Priority",
                mode: "multi",
                value: filters.priority,
                allLabel: "All priorities",
                options: Object.entries(priorityConfig).map(([value, label]) => ({
                  value,
                  label,
                })),
                onToggle: (value) => toggleFilter("priority", value),
                onClear: () => setFilter("priority", undefined),
              },
              {
                key: "assignee",
                label: "Assignee",
                mode: "text",
                value: filters.assignee,
                placeholder: "Filter by name...",
                onChange: (value) => setFilter("assignee", value),
              },
            ]}
            onClearAll={() => {
              setFilter("status", undefined);
              setFilter("priority", undefined);
              setFilter("assignee", undefined);
            }}
          />
          <span className="text-muted-foreground text-xs tabular-nums">{tasks.length}</span>
        </AppHeader>

        {/* Mobile: simple list */}
        <div className="flex-1 overflow-auto sm:hidden">
          <div className="grid gap-0.5 p-4">
            {tasks.map((t) => (
              <TaskListItem
                key={t.id}
                task={t}
                to={`/repos/${repoId}/tasks/${t.id}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop: full table */}
        <div className="hidden flex-1 overflow-auto sm:block">
          <TaskTable tasks={tasks} repoId={repoId} />
        </div>
      </div>

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repoId={repoId} />
    </>
  );
}

// ── Create Task Dialog ──────────────────────────────────────────────────────

const priorityOptions = [
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
] as const;

function CreateTaskDialog({
  open,
  onOpenChange,
  repoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
}) {
  const utils = trpc.useUtils();
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
  });

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: undefined,
      status: "backlog",
      priority: 3,
    },
  });

  function onSubmit(values: CreateTaskForm) {
    createTask.mutate({
      repoId,
      title: values.title,
      description: values.description?.trim() || undefined,
      status: values.status,
      priority: values.priority,
      labels: [],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taskStatusEnum.enumValues.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusConfig[s]?.label ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Priority</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" size="sm">
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
