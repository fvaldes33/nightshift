import {
  CirclePlayIcon,
  FolderGitIcon,
  MessageSquareIcon,
  PlusIcon,
} from "lucide-react";
import { Link, useRouteLoaderData } from "react-router";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@openralph/ui/components/empty";
import { Progress } from "@openralph/ui/components/progress";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard — ralph" }];
}

export default function Dashboard() {
  const data = useRouteLoaderData("routes/app-layout") as {
    sessions: Array<{
      id: string;
      title: string;
      mode: string;
      status: string;
      updatedAt: string;
      repo: { owner: string; name: string } | null;
    }>;
    repos: Array<{
      id: string;
      owner: string;
      name: string;
      defaultBranch: string;
    }>;
    loops: Array<{
      id: string;
      name: string;
      status: string;
      currentIteration: number;
      maxIterations: number;
    }>;
  };

  const sessions = data?.sessions ?? [];
  const repos = data?.repos ?? [];
  const loops = data?.loops ?? [];
  const activeLoops = loops.filter((l) => l.status === "running" || l.status === "queued");

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/sessions/new">
            <PlusIcon className="size-3.5" />
            New Session
          </Link>
        </Button>
      </div>

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

      {/* Recent Sessions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </h2>
        {sessions.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquareIcon />
              </EmptyMedia>
              <EmptyTitle>No sessions yet</EmptyTitle>
              <EmptyDescription>
                Start a new session to begin working with ralph.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                {s.repo && (
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-32">
                    {s.repo.owner}/{s.repo.name}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] font-mono">
                  {s.mode}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Repos */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Repos
        </h2>
        {repos.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGitIcon />
              </EmptyMedia>
              <EmptyTitle>No repos connected</EmptyTitle>
              <EmptyDescription>
                Connect a GitHub repo to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((r) => (
              <Link
                key={r.id}
                to={`/repos/${r.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 hover:bg-accent/50 transition-colors"
              >
                <FolderGitIcon className="size-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {r.owner}/{r.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {r.defaultBranch}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
