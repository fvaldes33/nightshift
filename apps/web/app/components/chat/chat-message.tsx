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
import { toolRenderMap, type AnyToolPart, type ToolPart } from "./tools";

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

          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const toolPart = part as AnyToolPart;
            const toolType = (toolPart.type === "dynamic-tool" ? `tool-${toolPart.toolName}` : toolPart.type) as `tool-${string}`;
            const CustomTool = toolRenderMap.get(toolType);

            if (CustomTool) return <CustomTool key={index} part={toolPart as ToolPart} />;

            return (
              <Tool key={index}>
                <ToolHeader
                  type={toolType}
                  state={toolPart.state}
                  title={toolType.replace("tool-", "")}
                />
                <ToolContent>
                  <ToolInput input={toolPart.input} />
                  <ToolOutput
                    output={"output" in toolPart && toolPart.output !== undefined ? toolPart.output : undefined}
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
