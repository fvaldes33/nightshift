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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openralph/ui/components/breadcrumb";
import { Button } from "@openralph/ui/components/button";
import {
  CheckCircleIcon,
  ListChecksIcon,
  Loader2Icon,
  MessageSquareIcon,
  NotebookTextIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AppHeader } from "~/components/app-header";
import {
  ImportClaudeSessions,
  ImportClaudeSessionsDialog,
  ImportClaudeSessionsDialogTrigger,
} from "~/components/import-claude-sessions-dialog";
import { LoopListItem } from "~/components/loops/loop-list-item";
import { SessionListItem } from "~/components/sessions/session-list-item";
import { TaskListItem } from "~/components/tasks/task-list-item";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Repo — nightshift" }];
}

function WorkspaceStatusBadge({ status }: { status: WorkspaceStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="gap-1.5 text-[10px]">
          <Loader2Icon className="size-3 animate-spin" />
          Pending
        </Badge>
      );
    case "cloning":
      return (
        <Badge variant="outline" className="gap-1.5 text-[10px]">
          <Loader2Icon className="size-3 animate-spin" />
          Cloning
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="secondary" className="gap-1.5 text-[10px] text-green-500">
          <CheckCircleIcon className="size-3" />
          Ready
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1.5 text-[10px]">
          <XCircleIcon className="size-3" />
          Failed
        </Badge>
      );
  }
}

export default function RepoDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: repo, isLoading } = trpc.repo.get.useQuery({ id: params.repoId! });
  const { data: sessions = [] } = trpc.session.list.useQuery({ repoId: params.repoId });
  const { data: tasks = [] } = trpc.task.list.useQuery({ repoId: params.repoId });
  const { data: loops = [] } = trpc.loop.list.useQuery({ repoId: params.repoId });
  const { data: docs = [] } = trpc.doc.list.useQuery({ repoId: params.repoId });

  const deleteRepo = trpc.repo.delete.useMutation({
    onSuccess: () => {
      utils.repo.list.invalidate();
      navigate("/repos");
    },
  });

  if (isLoading || !repo) return null;

  function handleDeleteRepo() {
    deleteRepo.mutate({ id: repo!.id });
  }

  const activeLoops = loops.filter((l) => l.status === "running" || l.status === "queued");

  return (
    <div className="flex flex-col overflow-auto">
      <AppHeader
        actions={
          <>
            <WorkspaceStatusBadge status={repo.workspaceStatus} />
            <Badge variant="secondary" className="font-mono text-[10px]">
              {repo.defaultBranch}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive-foreground size-7"
              onClick={() => setDeleteOpen(true)}
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </>
        }
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {repo.owner}/{repo.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </AppHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {repo.workspaceStatus === "failed" && repo.workspaceError && (
          <p className="text-destructive-foreground text-xs">{repo.workspaceError}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to={`/repos/${repo.id}/sessions/new`}
            className="border-border/50 bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <MessageSquareIcon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tabular-nums">{sessions.length}</span>
              <span className="text-muted-foreground text-xs">Sessions</span>
            </div>
          </Link>
          <Link
            to={`/repos/${repo.id}/tasks`}
            className="border-border/50 bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <ListChecksIcon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tabular-nums">{tasks.length}</span>
              <span className="text-muted-foreground text-xs">Tasks</span>
            </div>
          </Link>
          <Link
            to={`/repos/${repo.id}/loops`}
            className="border-border/50 bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <RepeatIcon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tabular-nums">{activeLoops.length}</span>
              <span className="text-muted-foreground text-xs">Active Loops</span>
            </div>
          </Link>
          <Link
            to={`/repos/${repo.id}/docs`}
            className="border-border/50 bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
          >
            <NotebookTextIcon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold tabular-nums">{docs.length}</span>
              <span className="text-muted-foreground text-xs">Docs</span>
            </div>
          </Link>
        </div>

        {/* Recent Sessions */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Recent Sessions
            </h2>
            <div className="flex-1" />
            <ImportClaudeSessions repoId={repo.id}>
              <ImportClaudeSessionsDialogTrigger>Import</ImportClaudeSessionsDialogTrigger>
              <ImportClaudeSessionsDialog />
            </ImportClaudeSessions>
            <Button variant="default" size="sm" className="h-7 text-xs" asChild>
              <Link to={`/repos/${repo.id}/sessions/new`}>
                <PlusIcon className="size-3.5" />
                New
              </Link>
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
          ) : (
            <div className="grid gap-1">
              {sessions.slice(0, 10).map((s) => (
                <SessionListItem
                  key={s.id}
                  session={s}
                  to={`/repos/${repo.id}/sessions/${s.id}`}
                  showRepo={false}
                />
              ))}
            </div>
          )}
        </section>

        {/* Tasks */}
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
            Tasks
          </h2>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks yet.</p>
          ) : (
            <div className="grid gap-0.5">
              {tasks.slice(0, 10).map((t) => (
                <TaskListItem key={t.id} task={t} to={`/repos/${repo.id}/tasks/${t.id}`} />
              ))}
            </div>
          )}
        </section>

        {/* Active Loops */}
        {activeLoops.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Active Loops
            </h2>
            <div className="grid gap-0.5">
              {activeLoops.map((loop) => (
                <LoopListItem key={loop.id} loop={loop} to={`/repos/${repo.id}/loops/${loop.id}`} />
              ))}
            </div>
          </section>
        )}

        {/* Delete dialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete repo?</AlertDialogTitle>
              <AlertDialogDescription>
                "{repo.owner}/{repo.name}" and all associated data will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDeleteRepo}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
