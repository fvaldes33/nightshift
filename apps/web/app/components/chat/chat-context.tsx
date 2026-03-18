import { Chat } from "@ai-sdk/react";
import type { NightshiftDataTypes, NightshiftMessage } from "@openralph/backend/tools/index";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { createContext, useContext, useState } from "react";
import { useExplorationStore } from "~/hooks/use-exploration-store";

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

function createChatInstance(
  session: SessionContext,
  initialMessages: NightshiftMessage[],
  onExplorationData: (data: {
    status: "running" | "complete" | "error";
    tool: string | null;
    elapsed: number;
  }) => void,
) {
  return new Chat<NightshiftMessage>({
    id: session.id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onData: (dataPart) => {
      if (dataPart.type === "data-exploration") {
        onExplorationData(
          dataPart.data as Extract<NightshiftDataTypes, { type: "data-exploration" }>["data"],
        );
      }
    },
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
  const explorationUpdate = useExplorationStore((s) => s.update);
  const explorationClear = useExplorationStore((s) => s.clear);
  const [chat] = useState(() =>
    createChatInstance(session, initialMessages, (data) => {
      explorationUpdate(data);
      // Auto-clear after completion
      if (data.status === "complete" || data.status === "error") {
        setTimeout(() => explorationClear(), 3000);
      }
    }),
  );

  return <ChatContext.Provider value={{ chat, session }}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
