import { createCaller } from "@openralph/backend/lib/caller";
import type { TaskComment } from "@openralph/db/models/task.model";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openralph/ui/components/alert-dialog";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { Input } from "@openralph/ui/components/input";
import { Label } from "@openralph/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { Separator } from "@openralph/ui/components/separator";
import { Textarea } from "@openralph/ui/components/textarea";
import { ArrowLeftIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData, useNavigate, useRevalidator } from "react-router";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/task";

const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"] as const;

const statusLabel: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

const priorityLabel: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

const statusColor: Record<string, string> = {
  backlog: "bg-muted-foreground",
  todo: "bg-blue-500",
  in_progress: "bg-yellow-500",
  done: "bg-green-500",
  canceled: "bg-red-500",
};

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

  const { data } = trpc.task.get.useQuery(
    { id: initialTask.id },
    { initialData: initialTask },
  );
  const task = data ?? initialTask;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description ?? "");
  const [commentText, setCommentText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => revalidator.revalidate(),
  });

  const addComment = trpc.task.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      revalidator.revalidate();
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => navigate("/tasks"),
  });

  function handleTitleBlur() {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== task.title) {
      updateTask.mutate({ id: task.id, title: titleValue.trim() });
    }
  }

  function handleDescriptionBlur() {
    const val = descriptionValue.trim();
    if (val !== (task.description ?? "")) {
      updateTask.mutate({ id: task.id, description: val || undefined });
    }
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    addComment.mutate({
      id: task.id,
      comment: {
        id: crypto.randomUUID(),
        author: "You",
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
      },
    });
  }

  const comments = (task.comments ?? []) as TaskComment[];

  return (
    <div className="flex flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tasks">
            <ArrowLeftIcon className="size-4" />
            Tasks
          </Link>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive-foreground"
          onClick={() => setDeleteOpen(true)}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      {/* Title */}
      {editingTitle ? (
        <Input
          autoFocus
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
          className="text-lg font-semibold"
        />
      ) : (
        <h1
          className="cursor-pointer text-lg font-semibold hover:text-foreground/80"
          onClick={() => setEditingTitle(true)}
        >
          {task.title}
        </h1>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={task.status}
            onValueChange={(v) =>
              updateTask.mutate({ id: task.id, status: v as (typeof STATUSES)[number] })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <Select
            value={String(task.priority)}
            onValueChange={(v) => updateTask.mutate({ id: task.id, priority: Number(v) })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Urgent</SelectItem>
              <SelectItem value="2">High</SelectItem>
              <SelectItem value="3">Medium</SelectItem>
              <SelectItem value="4">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {task.assignee && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Assignee</Label>
            <span className="text-sm">{task.assignee}</span>
          </div>
        )}

        {task.labels.length > 0 && (
          <div className="flex items-center gap-1.5">
            {task.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Description */}
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea
          placeholder="Add a description..."
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={4}
        />
      </div>

      {/* Subtasks */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">Subtasks</Label>
          <div className="grid gap-1">
            {task.subtasks.map((sub) => (
              <Link
                key={sub.id}
                to={`/tasks/${sub.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${statusColor[sub.status] ?? "bg-muted-foreground"}`}
                />
                <span className="flex-1 truncate text-sm">{sub.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Comments */}
      <div className="grid gap-3">
        <Label className="text-xs text-muted-foreground">Comments</Label>
        {comments.length > 0 && (
          <div className="grid gap-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/50 bg-card p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{c.content}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!commentText.trim() || addComment.isPending}
            onClick={handleAddComment}
            className="self-end"
          >
            Comment
          </Button>
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteTask.isPending}
              onClick={() => deleteTask.mutate({ id: task.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
