import { createCaller } from "@openralph/backend/lib/caller";
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
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import {
  ArrowLeftIcon,
  CirclePlayIcon,
  FolderTreeIcon,
  ListChecksIcon,
  MessageSquareIcon,
  RepeatIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { DataTable } from "~/components/data-table";
import { taskColumns } from "~/components/task-columns";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/repo";

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const [repo, sessions, tasks, loops] = await Promise.all([
    caller.repo.get({ id: params.repoId }),
    caller.session.list({ repoId: params.repoId }),
    caller.task.list({ repoId: params.repoId }),
    caller.loop.list({ repoId: params.repoId }),
  ]);
  return { repo, sessions, tasks, loops };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const repo = loaderData?.repo;
  const title = repo ? `${repo.owner}/${repo.name}` : "Repo";
  return [{ title: `${title} — ralph` }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RepoDetail() {
  const { repo, sessions, tasks, loops } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteRepo = trpc.repo.delete.useMutation({
    onSuccess: () => navigate("/repos"),
  });

  const activeWorktrees = sessions.filter(
    (s) => s.workspaceStatus === "ready" && s.worktreePath,
  ).length;

  const activeLoops = loops.filter(
    (l) => l.status === "running" || l.status === "queued",
  );

  const table = useReactTable({
    data: tasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

      <h1 className="text-lg font-semibold">
        {repo.owner}/{repo.name}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
          <FolderTreeIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{activeWorktrees}</span>
            <span className="text-xs text-muted-foreground">Active Worktrees</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
          <ListChecksIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{tasks.length}</span>
            <span className="text-xs text-muted-foreground">Tasks</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
          <RepeatIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">{activeLoops.length}</span>
            <span className="text-xs text-muted-foreground">Active Loops</span>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <div className="grid gap-1">
            {sessions.slice(0, 10).map((s) => (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
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
            <DataTable
              table={table}
              onRowClick={(row) => navigate(`/tasks/${row.id}`)}
            />
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
                to={`/loops/${loop.id}`}
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
              disabled={deleteRepo.isPending}
              onClick={() => deleteRepo.mutate({ id: repo.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
