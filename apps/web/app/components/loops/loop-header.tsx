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
import { Button } from "@openralph/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openralph/ui/components/dropdown-menu";
import {
  ArrowLeftIcon,
  CopyIcon,
  GitPullRequestIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

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

  const session = loop.session;
  const prUrl = session?.prUrl;
  const prNumber = session?.prNumber;
  const prStatus = session?.prStatus;

  return (
    <>
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link to={loopsUrl}>
            <ArrowLeftIcon className="size-3.5" />
          </Link>
        </Button>

        <nav className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link to={loopsUrl} className="hover:text-foreground transition-colors">
            Loops
          </Link>
          <span className="text-muted-foreground/50 hidden sm:inline">/</span>
          <span className="text-foreground hidden max-w-[300px] truncate sm:inline">
            {loop.name}
          </span>
        </nav>

        <div className="flex-1" />

        {prUrl && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={prUrl} target="_blank" rel="noopener noreferrer">
              <GitPullRequestIcon className={`size-3 ${prStatusColor[prStatus ?? "open"]}`} />
              PR #{prNumber}
              {prStatus && prStatus !== "open" && <span className="capitalize">{prStatus}</span>}
            </a>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)}>
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
