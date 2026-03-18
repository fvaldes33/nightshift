import { zodResolver } from "@hookform/resolvers/zod";
import type { RepoListItem } from "@openralph/backend/types/repo.types";
import { insertTaskSchema, taskStatusEnum } from "@openralph/db/models/task.model";
import { Button } from "@openralph/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@openralph/ui/components/combobox";
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
import { z } from "zod";
import { ListFilterMenu } from "~/components/list-filter-menu";
import { statusConfig } from "~/components/task-columns";
import { TaskTable } from "~/components/task-table";
import { useRepos, useTasks } from "~/hooks/use-collection";
import { useTableParams } from "~/hooks/use-table-params";
import { createTaskCollection } from "~/lib/collections";

// ── Form schema ──────────────────────────────────────────────────────────────

const createTaskSchema = insertTaskSchema.pick({
  title: true,
  description: true,
  status: true,
  priority: true,
  repoId: true,
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

export function meta() {
  return [{ title: "Tasks — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { filters, setFilter } = useTableParams({
    filterKeys: ["status", "assignee"] as const,
  });

  const { data: tasks, collection: taskCollection } = useTasks({
    status: filters.status,
    assignee: filters.assignee,
  });
  const { data: repos } = useRepos();

  const hasFilters = filters.status || filters.assignee;
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
        <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repos={repos} taskCollection={taskCollection} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b p-4">
          <ListFilterMenu
            className="h-8 text-xs"
            groups={[
              {
                key: "status",
                label: "Status",
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
                onChange: (value) => setFilter("status", value),
              },
            ]}
            onClearAll={() => {
              setFilter("status", undefined);
              setFilter("assignee", undefined);
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
              {tasks.length} tasks
            </span>
            <Button size="sm" className="h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              New task
            </Button>
          </div>
          <span className="text-muted-foreground w-full text-xs tabular-nums sm:hidden">
            {tasks.length} tasks
          </span>
        </div>

        <TaskTable tasks={tasks} />
      </div>

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repos={repos} taskCollection={taskCollection} />
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
  repos,
  taskCollection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: RepoListItem[];
  taskCollection: ReturnType<typeof createTaskCollection>;
}) {
  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: undefined,
      status: "backlog",
      priority: 3,
      repoId: undefined,
    },
  });

  function onSubmit(values: CreateTaskForm) {
    taskCollection.insert({
      id: crypto.randomUUID(),
      ...values,
      description: values.description?.trim() || null,
      labels: [],
      assignee: null,
      sessionId: null,
      parentId: null,
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      subtasks: [],
    } as any);
    onOpenChange(false);
    form.reset();
  }

  const selectedRepoId = form.watch("repoId");
  const selectedRepo = repos.find((r) => r.id === selectedRepoId) ?? null;

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

            <FormField
              control={form.control}
              name="repoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository</FormLabel>
                  <FormControl>
                    <Combobox
                      items={repos}
                      value={selectedRepo}
                      onValueChange={(item: RepoListItem | null) => {
                        field.onChange(item?.id ?? undefined);
                      }}
                      itemToStringLabel={(item: RepoListItem) => `${item.owner}/${item.name}`}
                    >
                      <ComboboxInput
                        showClear={!!selectedRepoId}
                        showTrigger={!selectedRepoId}
                        placeholder="Search repos..."
                        className="font-mono text-sm"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No repos found</ComboboxEmpty>
                        <ComboboxList>
                          {(item: RepoListItem) => (
                            <ComboboxItem key={item.id} value={item}>
                              <span className="font-mono text-sm">
                                {item.owner}/{item.name}
                              </span>
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
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
