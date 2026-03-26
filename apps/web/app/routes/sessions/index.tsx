import { Button } from "@openralph/ui/components/button";
import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { AppHeader } from "~/components/app-header";
import { SessionListItem } from "~/components/sessions/session-list-item";
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
      <AppHeader
        actions={
          <Button size="sm" className="h-7" asChild>
            <Link to={`/repos/${repoId}/sessions/new`}>
              <PlusIcon className="size-3.5" />
              New
            </Link>
          </Button>
        }
      >
        <h1 className="text-sm font-semibold">Sessions</h1>
        <span className="text-muted-foreground text-xs tabular-nums">{sessions.length}</span>
      </AppHeader>
      <div className="flex-1 overflow-auto">
        <div className="grid gap-1 p-4">
          {sessions.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              to={`/repos/${repoId}/sessions/${s.id}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
