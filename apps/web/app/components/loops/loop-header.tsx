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
import { ArrowLeftIcon, CopyIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

interface LoopHeaderProps {
  loop: LoopGetOutput;
  onDelete: () => void;
}

export function LoopHeader({ loop, onDelete }: LoopHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const progress =
    loop.maxIterations > 0
      ? (loop.currentIteration / loop.maxIterations) * 100
      : 0;

  return (
    <>
      <div className="border-border/50 flex items-center gap-2 border-b px-6 py-3">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link to="/loops">
            <ArrowLeftIcon className="size-3.5" />
          </Link>
        </Button>

        <nav className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link to="/loops" className="hover:text-foreground transition-colors">
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

        {loop.repo && (
          <Badge variant="outline" className="font-mono text-[10px]" asChild>
            <Link to={`/repos/${loop.repo.id}`}>
              {loop.repo.owner}/{loop.repo.name}
            </Link>
          </Badge>
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
    </>
  );
}
