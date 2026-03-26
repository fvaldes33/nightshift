import {
  FolderGitIcon,
  MessageSquareIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@openralph/ui/components/empty";
import { AppHeader } from "~/components/app-header";
import { LoopListItem } from "~/components/loops/loop-list-item";
import { SessionListItem } from "~/components/sessions/session-list-item";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Dashboard — nightshift" }];
}

export default function Dashboard() {
  const { data: repos = [] } = trpc.repo.list.useQuery({});
  const { data: sessions = [] } = trpc.session.list.useQuery({});
  const { data: loops = [] } = trpc.loop.list.useQuery({});
  const activeLoops = loops.filter((l) => l.status === "running" || l.status === "queued");

  return (
    <div className="flex flex-col overflow-auto">
      <AppHeader>
        <h1 className="text-sm font-semibold">Dashboard</h1>
      </AppHeader>

      <div className="flex flex-col gap-8 p-4 sm:p-6">

      {/* Active Loops */}
      {activeLoops.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Active Loops
          </h2>
          <div className="grid gap-0.5">
            {activeLoops.map((loop) => (
              <LoopListItem
                key={loop.id}
                loop={loop}
                to={`/repos/${loop.repoId}/loops/${loop.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Sessions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
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
                Start a new session from a workspace to begin working with nightshift.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-1">
            {sessions.slice(0, 10).map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                to={`/repos/${s.repoId}/sessions/${s.id}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Repos */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Workspaces
        </h2>
        {repos.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGitIcon />
              </EmptyMedia>
              <EmptyTitle>No workspaces yet</EmptyTitle>
              <EmptyDescription>
                Import a GitHub repo to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((r) => (
              <Link
                key={r.id}
                to={`/repos/${r.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <FolderGitIcon className="size-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {r.owner}/{r.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {r.defaultBranch}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
