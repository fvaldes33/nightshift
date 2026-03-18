import { createCaller } from "@openralph/backend/lib/caller";
import type { TaskComment } from "@openralph/db/models/task.model";
import { Separator } from "@openralph/ui/components/separator";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { TaskActivity } from "~/components/tasks/task-activity";
import { TaskDescription } from "~/components/tasks/task-description";
import { TaskHeader } from "~/components/tasks/task-header";
import { TaskProperties } from "~/components/tasks/task-properties";
import { TaskSubtasks } from "~/components/tasks/task-subtasks";
import { TaskTitle } from "~/components/tasks/task-title";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/task";

export async function loader({ request, params }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const task = await caller.task.get({ id: params.taskId });
  return { task };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.task.title ?? "Task"} — nightshift` }];
}

export default function TaskDetail() {
  const { task: initialTask } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const utils = trpc.useUtils();

  const { data } = trpc.task.get.useQuery(
    { id: initialTask.id },
    { initialData: initialTask },
  );
  const task = data ?? initialTask;

  function invalidate() {
    utils.task.get.invalidate({ id: task.id });
    revalidator.revalidate();
  }

  const updateTask = trpc.task.update.useMutation({
    onSuccess: invalidate,
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => navigate("/tasks"),
  });

  function handleUpdate(fields: Record<string, unknown>) {
    updateTask.mutate({ id: task.id, ...fields });
  }

  const comments = (task.comments ?? []) as TaskComment[];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TaskHeader
        task={task}
        onDelete={() => deleteTask.mutate({ id: task.id })}
        isDeleting={deleteTask.isPending}
      />

      <div className="flex min-h-0 flex-1">
        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-12 py-6">
            <TaskTitle value={task.title} onUpdate={handleUpdate} />
            <TaskDescription
              value={task.description ?? ""}
              onUpdate={handleUpdate}
            />
            <TaskSubtasks
              taskId={task.id}
              subtasks={task.subtasks ?? []}
              onCreated={invalidate}
            />
            <Separator className="bg-border/50" />
            <TaskActivity
              taskId={task.id}
              comments={comments}
              onCommentAdded={invalidate}
            />
          </div>
        </div>

        {/* Properties sidebar */}
        <div className="border-border/50 w-[280px] shrink-0 border-l overflow-y-auto">
          <TaskProperties task={task} onUpdate={handleUpdate} />
        </div>
      </div>
    </div>
  );
}
