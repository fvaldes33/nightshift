import type { NightshiftMessage } from "@openralph/backend/tools/index";
import type { Message } from "@openralph/db/models/message.model";
import type { WorkspaceStatus } from "@openralph/db/models/repo.model";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openralph/ui/components/dropdown-menu";
import { Input } from "@openralph/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openralph/ui/components/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openralph/ui/components/breadcrumb";
import { toast } from "@openralph/ui/components/sonner";
import {
  ArrowLeftToLineIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CopyIcon,
  GitPullRequestIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AppHeader } from "~/components/app-header";
import { ChatView } from "~/components/chat/chat-view";
import { CreatePRDialog } from "~/components/sessions/create-pr-dialog";
import { trpc } from "~/lib/trpc-react";

const prStatusColor: Record<string, string> = {
  open: "text-green-500",
  merged: "text-purple-500",
  closed: "text-red-500",
};

function toUIMessages(dbMessages: Message[]): NightshiftMessage[] {
  return dbMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as NightshiftMessage["parts"],
      createdAt: m.createdAt,
    }));
}

export function meta() {
  return [{ title: "Session — nightshift" }];
}

function WorkspaceStatusIndicator({
  status,
  error,
}: {
  status: WorkspaceStatus;
  error: string | null;
}) {
  switch (status) {
    case "pending":
    case "cloning":
      return (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          {status === "cloning" ? "Cloning repository..." : "Setting up workspace..."}
        </div>
      );
    case "ready":
      return (
        <div className="flex items-center gap-2 text-sm text-green-500">
          <CheckCircleIcon className="size-4" />
          Workspace ready
        </div>
      );
    case "failed":
      return (
        <div className="flex flex-col gap-1">
          <div className="text-destructive-foreground flex items-center gap-2 text-sm">
            <XCircleIcon className="size-4" />
            Workspace setup failed
          </div>
          {error && <p className="text-muted-foreground font-mono text-xs">{error}</p>}
        </div>
      );
  }
}

export default function Session() {
  const params = useParams();
  const navigate = useNavigate();
  const repoId = params.repoId!;
  const utils = trpc.useUtils();
  const { data: session, isLoading } = trpc.session.get.useQuery({ id: params.sessionId! });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);

  const updateSession = trpc.session.update.useMutation();
  const pushMutation = trpc.session.push.useMutation();
  const handoffMutation = trpc.session.handoff.useMutation({
    onSuccess: () => {
      utils.session.get.invalidate({ id: params.sessionId! });
    },
    onError: (err) => {
      toast(err.message);
    },
  });
  const deleteSession = trpc.session.delete.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate();
      navigate(`/repos/${repoId}/sessions`);
    },
  });

  const { data: gitStatus } = trpc.session.gitStatus.useQuery(
    { id: params.sessionId! },
    { enabled: !!session && !session.prUrl },
  );

  if (isLoading || !session) return null;

  const initialMessages = toUIMessages(session.messages);
  const workspaceReady = session.repo?.workspaceStatus === "ready";

  function handleDelete() {
    deleteSession.mutate({ id: session!.id });
  }

  function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateSession.mutate({ id: session!.id, title: trimmed });
    setRenameOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <AppHeader
        actions={
          <>
            {session.prUrl ? (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                <a href={session.prUrl} target="_blank" rel="noopener noreferrer">
                  <GitPullRequestIcon
                    className={`size-3 ${prStatusColor[session.prStatus ?? "open"]}`}
                  />
                  PR #{session.prNumber}
                  {session.prStatus && session.prStatus !== "open" && (
                    <span className="capitalize">{session.prStatus}</span>
                  )}
                </a>
              </Button>
            ) : (
              <>
                {gitStatus && gitStatus.unpushedCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => pushMutation.mutate({ id: session.id })}
                        disabled={pushMutation.isPending}
                      >
                        {pushMutation.isPending ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : (
                          <ArrowUpIcon className="size-3" />
                        )}
                        Push
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {gitStatus.unpushedCount} unpushed commit{gitStatus.unpushedCount !== 1 ? "s" : ""}
                    </TooltipContent>
                  </Tooltip>
                )}
                <CreatePRDialog
                  sessionId={session.id}
                  sessionTitle={session.title}
                  defaultBranch={gitStatus?.defaultBranch ?? "main"}
                  trigger={
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                      <GitPullRequestIcon className="size-3" />
                      <span className="hidden sm:inline">Create PR</span>
                    </Button>
                  }
                />
              </>
            )}
            {session.workspaceMode === "worktree" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setHandoffOpen(true)}
                disabled={handoffMutation.isPending}
              >
                {handoffMutation.isPending ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <ArrowLeftToLineIcon className="size-3" />
                )}
                Handoff
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
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(session.title);
                    setRenameOpen(true);
                  }}
                >
                  <PencilIcon className="size-3.5" />
                  Rename
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
          </>
        }
      >
        <Breadcrumb>
          <BreadcrumbList>
            {session.repo && (
              <>
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbLink asChild>
                    <Link to={`/repos/${session.repoId}`}>
                      {session.repo.owner}/{session.repo.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate max-w-48">{session.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </AppHeader>

      {/* Content */}
      {workspaceReady ? (
        <ChatView
          session={{
            id: session.id,
            repoId: session.repoId,
            branch: session.branch,
          }}
          initialMessages={initialMessages}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <WorkspaceStatusIndicator
            status={session.repo?.workspaceStatus ?? "pending"}
            error={session.repo?.workspaceError ?? null}
          />
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              "{session.title}" and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
            placeholder="Session title"
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleRename}
              disabled={!renameValue.trim() || updateSession.isPending}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Handoff dialog */}
      <AlertDialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Handoff worktree?</AlertDialogTitle>
            <AlertDialogDescription>
              This will checkout the branch in the main repo and remove the worktree. The session
              will continue in local mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handoffMutation.mutate({ id: session.id })}
            >
              Handoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
