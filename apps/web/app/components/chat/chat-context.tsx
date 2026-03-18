import { Chat } from "@ai-sdk/react";
import type { NightshiftMessage } from "@openralph/backend/tools/index";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { createContext, useContext, useState } from "react";

export interface SessionContext {
  id: string;
  repoId: string | null;
  branch: string | null;
  worktreePath: string | null;
}

interface ChatContextValue {
  chat: Chat<NightshiftMessage>;
  session: SessionContext;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function createChatInstance(session: SessionContext, initialMessages: NightshiftMessage[]) {
  return new Chat<NightshiftMessage>({
    id: session.id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
}

export function ChatProvider({
  session,
  initialMessages,
  children,
}: {
  session: SessionContext;
  initialMessages: NightshiftMessage[];
  children: React.ReactNode;
}) {
  const [chat] = useState(() => createChatInstance(session, initialMessages));

  return <ChatContext.Provider value={{ chat, session }}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
