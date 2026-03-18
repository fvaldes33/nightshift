import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { useSessions } from "~/hooks/use-collection";

export function meta() {
  return [{ title: "Sessions — nightshift" }];
}

export default function Sessions() {
  const params = useParams();
  const repoId = params.repoId!;
  const { data: sessions } = useSessions({ repoId });

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <MessageSquareIcon className="text-muted-foreground mb-4 size-12" />
        <h3 className="text-lg font-semibold">No sessions yet</h3>
        <p className="text-muted-foreground mb-4 mt-1 text-sm">
          Start a session to chat with nightshift about this repo.
        </p>
        <Button size="sm" className="h-8" asChild>
          <Link to={`/repos/${repoId}/sessions/new`}>
            <PlusIcon className="size-3.5" />
            New Session
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center gap-2 border-b p-4">
        <h1 className="text-sm font-semibold">Sessions</h1>
        <span className="text-muted-foreground text-xs tabular-nums">{sessions.length}</span>
        <div className="flex-1" />
        <Button size="sm" className="h-8" asChild>
          <Link to={`/repos/${repoId}/sessions/new`}>
            <PlusIcon className="size-3.5" />
            New Session
          </Link>
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid gap-1 p-4">
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/repos/${repoId}/sessions/${s.id}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
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
      </div>
    </div>
  );
}
