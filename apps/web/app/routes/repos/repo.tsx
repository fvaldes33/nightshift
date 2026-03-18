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
import { Progress } from "@openralph/ui/components/progress";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CirclePlayIcon,
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
import { TaskTable } from "~/components/task-table";
import { useDocs, useLoops, useRepos, useSessions, useTasks } from "~/hooks/use-collection";
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

  const { data: repo, isLoading } = trpc.repo.get.useQuery({ id: params.repoId! });

  const { data: sessions } = useSessions({ repoId: params.repoId });
  const { data: tasks } = useTasks({ repoId: params.repoId });
  const { data: loops } = useLoops({ repoId: params.repoId });
  const { data: docs } = useDocs({ repoId: params.repoId });
  const { collection: repoCollection } = useRepos();

  if (isLoading || !repo) return null;

  function handleDeleteRepo() {
    repoCollection.delete(repo!.id);
    navigate("/repos");
  }

  const activeLoops = loops.filter(
    (l) => l.status === "running" || l.status === "queued",
  );

  return (
    <div className="flex flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/repos">
            <ArrowLeftIcon className="size-4" />
            Repos
          </Link>
        </Button>
        <div className="flex-1" />
        <WorkspaceStatusBadge status={repo.workspaceStatus} />
        <Badge variant="secondary" className="font-mono text-[10px]">
          {repo.defaultBranch}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive-foreground"
          onClick={() => setDeleteOpen(true)}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          {repo.owner}/{repo.name}
        </h1>
        {repo.workspaceStatus === "failed" && repo.workspaceError && (
          <p className="text-destructive-foreground text-xs">{repo.workspaceError}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Link
          to={`/repos/${repo.id}/sessions/new`}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <MessageSquareIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{sessions.length}</span>
            <span className="text-xs text-muted-foreground">Sessions</span>
          </div>
        </Link>
        <Link
          to={`/repos/${repo.id}/tasks`}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <ListChecksIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{tasks.length}</span>
            <span className="text-xs text-muted-foreground">Tasks</span>
          </div>
        </Link>
        <Link
          to={`/repos/${repo.id}/loops`}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <RepeatIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{activeLoops.length}</span>
            <span className="text-xs text-muted-foreground">Active Loops</span>
          </div>
        </Link>
        <Link
          to={`/repos/${repo.id}/docs`}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <NotebookTextIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{docs.length}</span>
            <span className="text-xs text-muted-foreground">Docs</span>
          </div>
        </Link>
      </div>

      {/* Recent Sessions */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Recent Sessions
          </h2>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link to={`/repos/${repo.id}/sessions/new`}>
              <PlusIcon className="size-3.5" />
              New
            </Link>
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <div className="grid gap-1">
            {sessions.slice(0, 10).map((s) => (
              <Link
                key={s.id}
                to={`/repos/${repo.id}/sessions/${s.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                <MessageSquareIcon className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-sm">{s.title}</span>
                {s.branch && (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {s.branch}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-mono">
                  {s.mode}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Tasks */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Tasks
        </h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <div className="rounded-lg border border-border/50">
            <TaskTable tasks={tasks} repoId={repo.id} />
          </div>
        )}
      </section>

      {/* Active Loops */}
      {activeLoops.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Active Loops
          </h2>
          <div className="grid gap-2">
            {activeLoops.map((loop) => (
              <Link
                key={loop.id}
                to={`/repos/${repo.id}/loops/${loop.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
              >
                <CirclePlayIcon className="size-4 text-green-500 shrink-0" />
                <span className="flex-1 truncate text-sm">{loop.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {loop.currentIteration}/{loop.maxIterations}
                </span>
                <Progress
                  value={(loop.currentIteration / loop.maxIterations) * 100}
                  className="w-20 h-1.5"
                />
              </Link>
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
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteRepo}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
