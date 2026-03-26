import type { TaskComment } from "@openralph/db/models/task.model";
import { Separator } from "@openralph/ui/components/separator";
import { useNavigate, useParams } from "react-router";
import { TaskActivity } from "~/components/tasks/task-activity";
import { TaskDescription } from "~/components/tasks/task-description";
import { TaskHeader } from "~/components/tasks/task-header";
import { TaskProperties } from "~/components/tasks/task-properties";
import { TaskPropertiesInline } from "~/components/tasks/task-properties-inline";
import { TaskSubtasks } from "~/components/tasks/task-subtasks";
import { TaskTitle } from "~/components/tasks/task-title";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Task — nightshift" }];
}

export default function TaskDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const repoId = params.repoId!;
  const utils = trpc.useUtils();

  const { data: task, isLoading } = trpc.task.get.useQuery({ id: params.taskId! });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.get.invalidate({ id: params.taskId! });
      utils.task.list.invalidate();
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      navigate(`/repos/${repoId}/tasks`);
    },
  });

  if (isLoading || !task) return null;

  function handleUpdate(fields: Record<string, unknown>) {
    updateTask.mutate({ id: task!.id, ...fields });
  }

  function handleDelete() {
    deleteTask.mutate({ id: task!.id });
  }

  const comments = (task.comments ?? []) as TaskComment[];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TaskHeader
        task={task}
        repoId={repoId}
        onDelete={handleDelete}
        isDeleting={false}
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-12 sm:py-6">
            <TaskTitle value={task.title} onUpdate={handleUpdate} />

            {/* Mobile: compact pill row between title and description */}
            <div className="sm:hidden">
              <TaskPropertiesInline task={task} onUpdate={handleUpdate} />
            </div>

            <TaskDescription
              value={task.description ?? ""}
              onUpdate={handleUpdate}
            />
            <TaskSubtasks
              taskId={task.id}
              repoId={repoId}
              subtasks={task.subtasks ?? []}
            />
            <Separator className="bg-border/50" />
            <TaskActivity
              taskId={task.id}
              comments={comments}
            />
          </div>
        </div>

        {/* Desktop: sidebar */}
        <div className="border-border/50 hidden w-[280px] shrink-0 border-l overflow-y-auto sm:block">
          <TaskProperties task={task} onUpdate={handleUpdate} />
        </div>
      </div>
    </div>
  );
}
