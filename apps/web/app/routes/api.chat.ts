import { auth } from "@openralph/backend/lib/auth";
import { ActorContext } from "@openralph/backend/lib/context";
import { streamChat } from "@openralph/backend/services/ai.service";
import { getSession } from "@openralph/backend/services/session.service";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { type ActionFunctionArgs, data } from "react-router";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession?.user) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id: sessionId, messages } = body as { id: string; messages: UIMessage[] };

  if (!sessionId || !messages?.length) {
    return data({ error: "Missing session id or messages" }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    return data({ error: "Last message must be from user" }, { status: 400 });
  }

  return ActorContext.with({ type: "user", properties: { user: authSession.user } }, async () => {
    const session = await getSession({ id: sessionId });

    if (session.workspaceStatus !== "ready") {
      return data({ error: "Workspace is not ready" }, { status: 400 });
    }

    const stream = streamChat({ session, messages });
    return createUIMessageStreamResponse({ stream });
  });
}
