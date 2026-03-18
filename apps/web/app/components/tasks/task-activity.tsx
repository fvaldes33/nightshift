import type { TaskComment } from "@openralph/db/models/task.model";
import { MarkdownContent } from "@openralph/ui/ai/markdown-content";
import { Button } from "@openralph/ui/components/button";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { trpc } from "~/lib/trpc-react";

interface TaskActivityProps {
  taskId: string;
  comments: TaskComment[];
}

export function TaskActivity({ taskId, comments }: TaskActivityProps) {
  const [text, setText] = useState("");

  const addComment = trpc.task.addComment.useMutation({
    onSuccess: () => {
      setText("");
    },
  });

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment.mutate({
      id: taskId,
      comment: {
        id: crypto.randomUUID(),
        author: "You",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return (
    <div className="space-y-4">
      <span className="text-muted-foreground text-xs font-medium">Activity</span>

      {comments.length > 0 && (
        <div className="space-y-1">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              taskId={taskId}
              allComments={comments}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a comment..."
          rows={3}
          className="border-border bg-muted/30 placeholder:text-muted-foreground/50 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) handleSubmit();
          }}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!text.trim() || addComment.isPending}
            onClick={handleSubmit}
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  taskId,
  allComments,
}: {
  comment: TaskComment;
  taskId: string;
  allComments: TaskComment[];
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const isOwn = comment.author === "You";

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      setEditing(false);
    },
  });

  function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === comment.content) {
      setEditing(false);
      setEditValue(comment.content);
      return;
    }
    const updated = allComments.map((c) =>
      c.id === comment.id ? { ...c, content: trimmed } : c,
    );
    updateTask.mutate({ id: taskId, comments: updated });
  }

  return (
    <div className="group flex gap-3 py-2">
      <div className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
        {comment.author[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.author}</span>
          <span className="text-muted-foreground text-[11px]">
            {formatRelativeDate(comment.createdAt)}
          </span>
          {isOwn && !editing && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-auto opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => {
                setEditValue(comment.content);
                setEditing(true);
              }}
            >
              <PencilIcon className="size-3" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              className="border-border bg-muted/30 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) saveEdit();
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditValue(comment.content);
                }
              }}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={saveEdit}
                disabled={updateTask.isPending}
              >
                <CheckIcon className="size-3" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => {
                  setEditing(false);
                  setEditValue(comment.content);
                }}
              >
                <XIcon className="size-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MarkdownContent className="mt-0.5 text-sm">{comment.content}</MarkdownContent>
        )}
      </div>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
