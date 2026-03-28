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
import { CheckIcon, ChevronDownIcon, ClipboardCopyIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { ClientOnly } from "../client-only";
import { isCompactToolPart, isPlanFilePart, PlanWriteTool, ToolCallGroup, toolRenderMap, type AnyToolPart, type ToolPart } from "./tools";

type MessagePart = NightshiftMessage["parts"][number];

type PartSegment =
  | { kind: "single"; part: MessagePart; index: number }
  | { kind: "tool-group"; parts: { part: AnyToolPart; index: number }[] };

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

  // Phase 1: Group consecutive compact tool parts into segments
  const segments = useMemo(() => {
    const result: PartSegment[] = [];
    let currentGroup: { part: AnyToolPart; index: number }[] = [];

    function flushGroup() {
      if (currentGroup.length > 0) {
        result.push({ kind: "tool-group", parts: currentGroup });
        currentGroup = [];
      }
    }

    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      const isToolPart = part.type.startsWith("tool-") || part.type === "dynamic-tool";

      if (isToolPart) {
        const toolPart = part as AnyToolPart;
        const toolType = (toolPart.type === "dynamic-tool" ? `tool-${toolPart.toolName}` : toolPart.type) as `tool-${string}`;

        if (isCompactToolPart(toolPart) && !isPlanFilePart(toolPart) && !toolRenderMap.has(toolType)) {
          currentGroup.push({ part: toolPart, index: i });
          continue;
        }
      }

      flushGroup();
      result.push({ kind: "single", part, index: i });
    }
    flushGroup();

    return result;
  }, [message.parts]);

  // Phase 2: Render segments
  function renderSinglePart(part: MessagePart, index: number) {
    if (part.type === "text") {
      return isUser ? (
        <TruncatedText key={index} text={part.text} />
      ) : (
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

      if (isPlanFilePart(toolPart)) {
        return <PlanWriteTool key={index} part={toolPart} />;
      }

      const toolType = (toolPart.type === "dynamic-tool" ? `tool-${toolPart.toolName}` : toolPart.type) as `tool-${string}`;
      const CustomTool = toolRenderMap.get(toolType);

      if (CustomTool) return <CustomTool key={index} part={toolPart as ToolPart} messageId={message.id} />;

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
  }

  if (!isUser && !isAssistant) return null;

  return (
    <Message from={message.role}>
      <MessageContent>
        {segments.map((segment, i) => {
          if (segment.kind === "tool-group") {
            return <ToolCallGroup key={segment.parts[0].index} parts={segment.parts} />;
          }
          return renderSinglePart(segment.part, segment.index);
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

const TRUNCATE_LINES = 40;

function TruncatedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => text.split("\n"), [text]);
  const isTruncatable = lines.length > TRUNCATE_LINES;
  const truncatedText = useMemo(
    () => (isTruncatable && !expanded ? lines.slice(0, TRUNCATE_LINES).join("\n") : text),
    [isTruncatable, expanded, lines, text],
  );

  return (
    <div>
      <div className={isTruncatable && !expanded ? "relative" : undefined}>
        <MessageResponse className="text-sm">{truncatedText}</MessageResponse>
        {isTruncatable && !expanded && (
          <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t" />
        )}
      </div>
      {isTruncatable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs"
        >
          <ChevronDownIcon className={`size-3 ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `Show ${lines.length - TRUNCATE_LINES} more lines`}
        </button>
      )}
    </div>
  );
}
