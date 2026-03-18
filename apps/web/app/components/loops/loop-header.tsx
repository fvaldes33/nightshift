import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openralph/ui/components/dropdown-menu";
import { Progress } from "@openralph/ui/components/progress";
import {
  ArrowLeftIcon,
  CopyIcon,
  FolderXIcon,
  GitPullRequestIcon,
  LoaderIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "@openralph/ui/components/sonner";
import { trpc } from "~/lib/trpc-react";
import { OpenPRDialog } from "./open-pr-dialog";

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

interface LoopHeaderProps {
  loop: LoopGetOutput;
  repoId: string;
  onDelete: () => void;
}

const prStatusColor: Record<string, string> = {
  open: "text-green-500",
  merged: "text-purple-500",
  closed: "text-red-500",
};

export function LoopHeader({ loop, repoId, onDelete }: LoopHeaderProps) {
  const loopsUrl = `/repos/${repoId}/loops`;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const syncPR = trpc.loop.syncPRStatus.useMutation({
    onSuccess: () => utils.loop.get.invalidate({ id: loop.id }),
  });

  const pushToRemote = trpc.loop.pushToRemote.useMutation({
    onSuccess: () => {
      utils.loop.get.invalidate({ id: loop.id });
      toast.success("Pushed to remote");
    },
    onError: (err) => toast.error(err.message),
  });

  const cleanupWorktree = trpc.loop.cleanupWorktree.useMutation({
    onSuccess: () => {
      utils.loop.get.invalidate({ id: loop.id });
      toast.success("Worktree removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const canOpenPR = loop.branch && ["complete", "failed"].includes(loop.status);
  const canPush = loop.prUrl && loop.worktree && ["complete", "failed"].includes(loop.status);

  const progress =
    loop.maxIterations > 0
      ? (loop.currentIteration / loop.maxIterations) * 100
      : 0;

  return (
    <>
      <div className="border-border/50 flex items-center gap-2 border-b px-6 py-3">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link to={loopsUrl}>
            <ArrowLeftIcon className="size-3.5" />
          </Link>
        </Button>

        <nav className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link to={loopsUrl} className="hover:text-foreground transition-colors">
            Loops
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground max-w-[300px] truncate">{loop.name}</span>
        </nav>

        <Badge variant="secondary" className="gap-1.5 text-[10px]">
          <span
            className={`size-2 rounded-full ${statusColor[loop.status] ?? "bg-muted-foreground"}`}
          />
          {loop.status}
        </Badge>

        <span className="font-mono text-xs text-muted-foreground">
          {loop.currentIteration}/{loop.maxIterations}
        </span>
        <Progress value={progress} className="h-1.5 w-16" />

        <div className="flex-1" />

        {loop.prUrl && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={loop.prUrl} target="_blank" rel="noopener noreferrer">
              <GitPullRequestIcon
                className={`size-3 ${prStatusColor[loop.prStatus ?? "open"]}`}
              />
              PR #{loop.prNumber}
              {loop.prStatus && loop.prStatus !== "open" && (
                <span className="capitalize">{loop.prStatus}</span>
              )}
            </a>
          </Button>
        )}

        {canPush && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => pushToRemote.mutate({ id: loop.id })}
            disabled={pushToRemote.isPending}
          >
            {pushToRemote.isPending ? (
              <LoaderIcon className="size-3 animate-spin" />
            ) : (
              <UploadIcon className="size-3" />
            )}
            Push Latest
          </Button>
        )}

        {canOpenPR && !loop.prUrl && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setPrDialogOpen(true)}
          >
            <GitPullRequestIcon className="size-3" />
            Open PR
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(window.location.href)}
            >
              <CopyIcon className="size-3.5" />
              Copy link
            </DropdownMenuItem>
            {loop.prUrl && loop.prStatus !== "merged" && (
              <DropdownMenuItem
                onClick={() => syncPR.mutate({ id: loop.id })}
                disabled={syncPR.isPending}
              >
                <RefreshCwIcon className="size-3.5" />
                Sync PR status
              </DropdownMenuItem>
            )}
            {loop.worktree && (
              <DropdownMenuItem
                onClick={() => cleanupWorktree.mutate({ id: loop.id })}
                disabled={cleanupWorktree.isPending}
              >
                <FolderXIcon className="size-3.5" />
                Remove worktree
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <TrashIcon className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loop?</AlertDialogTitle>
            <AlertDialogDescription>
              "{loop.name}" and all its events will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OpenPRDialog loop={loop} open={prDialogOpen} onOpenChange={setPrDialogOpen} />
    </>
  );
}
