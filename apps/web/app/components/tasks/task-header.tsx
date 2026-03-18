import type { TaskGetOutput } from "@openralph/backend/types/task.types";
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
import { Button } from "@openralph/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openralph/ui/components/dropdown-menu";
import { ArrowLeftIcon, CopyIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

interface TaskHeaderProps {
  task: TaskGetOutput;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function TaskHeader({ task, onDelete, isDeleting }: TaskHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="border-border/50 flex items-center gap-2 border-b px-6 py-3">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link to="/tasks">
            <ArrowLeftIcon className="size-3.5" />
          </Link>
        </Button>

        <nav className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link to="/tasks" className="hover:text-foreground transition-colors">
            Tasks
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground max-w-[300px] truncate">{task.title}</span>
        </nav>

        <div className="flex-1" />

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
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
