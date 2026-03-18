import { zodResolver } from "@hookform/resolvers/zod";
import { createCaller } from "@openralph/backend/lib/caller";
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
import { useLoaderData, useRevalidator } from "react-router";
import { z } from "zod";
import { ListFilterMenu } from "~/components/list-filter-menu";
import { statusConfig } from "~/components/task-columns";
import { TaskTable } from "~/components/task-table";
import { useTableParams } from "~/hooks/use-table-params";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/index";

// ── Form schema ──────────────────────────────────────────────────────────────

const createTaskSchema = insertTaskSchema.pick({
  title: true,
  description: true,
  status: true,
  priority: true,
  repoId: true,
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const assignee = url.searchParams.get("assignee") ?? undefined;
  const [tasks, repos] = await Promise.all([
    caller.task.list({ status, assignee }),
    caller.repo.list({}),
  ]);
  return { tasks, repos };
}

export function meta() {
  return [{ title: "Tasks — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { tasks: initialTasks, repos } = useLoaderData<typeof loader>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { filters, setFilter } = useTableParams({
    filterKeys: ["status", "assignee"] as const,
  });

  const { data } = trpc.task.list.useQuery(
    {
      status: filters.status,
      assignee: filters.assignee,
    },
    { initialData: initialTasks },
  );

  const tasks = data ?? initialTasks;

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
        <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repos={repos} />
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

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} repos={repos} />
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: RepoListItem[];
}) {
  const revalidator = useRevalidator();
  const utils = trpc.useUtils();

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

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      utils.task.list.invalidate();
      revalidator.revalidate();
    },
  });

  function onSubmit(values: CreateTaskForm) {
    createTask.mutate({
      ...values,
      description: values.description?.trim() || undefined,
      labels: [],
    });
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
              <Button type="submit" size="sm" disabled={createTask.isPending}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
