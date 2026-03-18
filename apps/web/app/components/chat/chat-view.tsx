import { useChat } from "@ai-sdk/react";
import type { NightshiftMessage } from "@openralph/backend/tools/index";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@openralph/ui/ai/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@openralph/ui/ai/prompt-input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@openralph/ui/components/resizable";
import { MessageSquareIcon } from "lucide-react";
import { useArtifactStore } from "~/hooks/use-artifact-store";
import { ArtifactPanel } from "./artifact-panel";
import { ChatProvider, type SessionContext, useChatContext } from "./chat-context";
import { ChatMessage } from "./chat-message";

interface ChatViewProps {
  session: SessionContext;
  initialMessages: NightshiftMessage[];
}

export function ChatView({ session, initialMessages }: ChatViewProps) {
  return (
    <ChatProvider session={session} initialMessages={initialMessages}>
      <ChatViewInner />
    </ChatProvider>
  );
}

function ChatViewInner() {
  const artifact = useArtifactStore((s) => s.artifact);
  const { chat } = useChatContext();
  const { messages, sendMessage, status, stop } = useChat({ chat });

  const isGenerating = status === "submitted" || status === "streaming";

  const chatPanel = (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-2xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Ask nightshift to explore, plan, or code in this repo."
              icon={<MessageSquareIcon className="size-8" />}
            />
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                status={index === messages.length - 1 && isGenerating ? status : "ready"}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-border/50 shrink-0 border-t py-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={({ text }) => {
              if (!text.trim()) return;
              sendMessage({ text });
            }}
          >
            <PromptInputTextarea placeholder="Ask nightshift..." />
            <PromptInputFooter>
              <div />
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="size-full">
      <ResizablePanel defaultSize={artifact ? 50 : 100} minSize={30}>
        {chatPanel}
      </ResizablePanel>
      {!artifact || (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            <ArtifactPanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
