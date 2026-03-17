import type { NightshiftMessage } from "@openralph/backend/tools/index";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@openralph/ui/ai/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@openralph/ui/ai/reasoning";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@openralph/ui/ai/tool";
import type { TextUIPart } from "ai";
import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { ClientOnly } from "../client-only";
import { toolRenderMap, type ToolPart } from "./tools";

interface ChatMessageProps {
  message: NightshiftMessage;
  status?: "submitted" | "streaming" | "ready" | "error";
}

export const ChatMessage = memo(function ChatMessage({ message, status }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreaming = status === "streaming";

  const fullTextContent = message.parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map((p) => p.text)
    .join("");

  if (!isUser && !isAssistant) return null;

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <MessageResponse key={index} className="text-sm">
                {part.text}
              </MessageResponse>
            );
          }

          if (part.type === "reasoning") {
            return (
              <ClientOnly key={index}>
                {() => (
                  <Reasoning isStreaming={isStreaming && index === message.parts.length - 1}>
                    <ReasoningTrigger />
                    <ReasoningContent>{part.text}</ReasoningContent>
                  </Reasoning>
                )}
              </ClientOnly>
            );
          }

          if (part.type.startsWith("tool-")) {
            const toolPart = part as ToolPart;
            const CustomTool = toolRenderMap.get(toolPart.type);

            if (CustomTool) return <CustomTool key={index} part={toolPart} />;

            return (
              <Tool key={index}>
                <ToolHeader
                  type={toolPart.type}
                  state={toolPart.state}
                  title={toolPart.type.replace("tool-", "")}
                />
                <ToolContent>
                  <ToolInput input={toolPart.input} />
                  <ToolOutput
                    output={toolPart.output !== undefined ? toolPart.output : undefined}
                    errorText={toolPart.errorText}
                  />
                </ToolContent>
              </Tool>
            );
          }

          return null;
        })}
      </MessageContent>

      {isAssistant && status !== "streaming" && fullTextContent && (
        <MessageActions>
          <MessageAction tooltip="Copy" onClick={() => copy(fullTextContent)}>
            {copied ? <CheckIcon size={12} /> : <ClipboardCopyIcon size={12} />}
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  );
});
