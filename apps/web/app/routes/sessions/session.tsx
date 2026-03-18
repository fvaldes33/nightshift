import { createCaller } from "@openralph/backend/lib/caller";
import type { NightshiftMessage } from "@openralph/backend/tools/index";
import type { Message } from "@openralph/db/models/message.model";
import type { WorkspaceStatus } from "@openralph/db/models/session.model";
import { Badge } from "@openralph/ui/components/badge";
import { CheckCircleIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useLoaderData } from "react-router";
import { ChatView } from "~/components/chat/chat-view";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/session";

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

export async function loader({ request, params }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const session = await caller.session.get({ id: params.sessionId });
  const initialMessages = toUIMessages(session.messages);
  return { session, initialMessages };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.session.title ?? "Session"} — nightshift` }];
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
  const { session: initialSession, initialMessages } = useLoaderData<typeof loader>();

  // Poll for workspace status while not ready
  const { data } = trpc.session.get.useQuery(
    { id: initialSession.id },
    {
      initialData: initialSession,
      refetchInterval: (query) => {
        const status = query.state.data?.workspaceStatus;
        return status === "pending" || status === "cloning" ? 1500 : false;
      },
    },
  );

  const session = data ?? initialSession;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Header */}
      <div className="border-border/50 sticky top-0 flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <h1 className="text-sm font-semibold">{session.title}</h1>
        {session.repo && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {session.repo.owner}/{session.repo.name}
          </Badge>
        )}
        {session.branch && (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {session.branch}
          </Badge>
        )}
      </div>

      {/* Content */}
      {session.workspaceStatus === "ready" ? (
        <ChatView
          session={{
            id: session.id,
            repoId: session.repoId,
            branch: session.branch,
            worktreePath: session.worktreePath,
          }}
          initialMessages={initialMessages}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <WorkspaceStatusIndicator
            status={session.workspaceStatus}
            error={session.workspaceError}
          />
        </div>
      )}
    </div>
  );
}
