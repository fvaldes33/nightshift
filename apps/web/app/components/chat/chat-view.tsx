import { useChat } from "@ai-sdk/react";
import type { NightshiftMessage } from "@openralph/backend/tools/index";
import type { DiscoveredCommand } from "@openralph/backend/services/skill-discovery.service";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@openralph/ui/ai/conversation";
import { type MentionItem, PromptEditor } from "@openralph/ui/components/prompt-editor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@openralph/ui/components/resizable";
import { Spinner } from "@openralph/ui/components/spinner";
import { cn } from "@openralph/ui/lib/utils";
import { CornerDownLeftIcon, MessageSquareIcon, SquareIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "~/lib/trpc-react";
import { usePlanStore } from "~/hooks/use-plan-store";
import { ChatProvider, type SessionContext, useChatContext } from "./chat-context";
import { ChatMessage } from "./chat-message";
import { PlanPanel } from "./plan-panel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFileItems(files: string[]): MentionItem[] {
  return files.map((filePath) => {
    const parts = filePath.split("/");
    const filename = parts.pop() ?? filePath;
    const dir = parts.length > 0 ? parts.join("/") : undefined;
    return {
      label: filename,
      value: filePath,
      type: "file" as const,
      detail: dir,
    };
  });
}

function buildCommandItems(commands: DiscoveredCommand[]): MentionItem[] {
  return commands.map((cmd) => ({
    label: cmd.name,
    value: cmd.name,
    type: "command" as const,
    detail: cmd.description,
  }));
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

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
  const plan = usePlanStore((s) => s.plan);
  const { chat, session } = useChatContext();
  const { messages, sendMessage, status, stop } = useChat({ chat });

  const [input, setInput] = useState("");
  const isGenerating = status === "submitted" || status === "streaming";

  // Pre-fetch file list for @ mentions
  const { data: files = [] } = trpc.session.listFiles.useQuery(
    { id: session.id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  // Discover available slash commands (skills + builtins)
  const { data: commands = [] } = trpc.session.listCommands.useQuery(
    { id: session.id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );

  const fileItems = useMemo(() => buildFileItems(files), [files]);
  const commandItems = useMemo(() => buildCommandItems(commands), [commands]);

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    sendMessage({ text });
    setInput("");
  };

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
        <div className="mx-auto w-full max-w-3xl px-4">
          <div
            className={cn(
              "border-input dark:bg-input/30 shadow-xs relative flex w-full flex-col rounded-lg border transition-[color,box-shadow]",
              "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            )}
          >
            <PromptEditor
              value={input}
              onValueChange={setInput}
              onSubmit={handleSubmit}
              fileItems={fileItems}
              commandItems={commandItems}
              disabled={isGenerating}
              placeholder="Ask nightshift..."
            />
            <div className="flex items-center justify-end gap-2 px-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  if (isGenerating) {
                    stop?.();
                  } else {
                    handleSubmit(input);
                  }
                }}
                className={cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-8 items-center justify-center rounded-md transition-colors",
                )}
                aria-label={isGenerating ? "Stop" : "Submit"}
              >
                {status === "submitted" ? (
                  <Spinner />
                ) : status === "streaming" ? (
                  <SquareIcon className="size-4" />
                ) : (
                  <CornerDownLeftIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="size-full">
      <ResizablePanel defaultSize={plan ? 50 : 100} minSize={30}>
        {chatPanel}
      </ResizablePanel>
      {!plan || (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            <PlanPanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
