import type { UIMessageStreamWriter } from "ai";
import { v4 as uuidv4 } from "uuid";
import type { ClaudeStreamEvent } from "./claude-runner";

// ---------------------------------------------------------------------------
// Adapter state — tracks step/part boundaries across events
// ---------------------------------------------------------------------------

export interface AdapterState {
  messageId: string;
  inStep: boolean;
}

export function createAdapterState(messageId: string): AdapterState {
  return { messageId, inStep: false };
}

// ---------------------------------------------------------------------------
// Write a single ClaudeStreamEvent to the UIMessageStreamWriter
// ---------------------------------------------------------------------------

function ensureStep(writer: UIMessageStreamWriter, state: AdapterState) {
  if (!state.inStep) {
    writer.write({ type: "start-step" });
    state.inStep = true;
  }
}

function finishStep(writer: UIMessageStreamWriter, state: AdapterState) {
  if (state.inStep) {
    writer.write({ type: "finish-step" });
    state.inStep = false;
  }
}

export function writeClaudeEventToStream(
  event: ClaudeStreamEvent,
  writer: UIMessageStreamWriter,
  state: AdapterState,
): void {
  switch (event.type) {
    case "init":
      // No-op — sessionId captured by the caller
      break;

    case "thinking": {
      ensureStep(writer, state);
      const id = uuidv4();
      writer.write({ type: "reasoning-start", id });
      writer.write({ type: "reasoning-delta", id, delta: event.text });
      writer.write({ type: "reasoning-end", id });
      break;
    }

    case "assistant": {
      ensureStep(writer, state);
      const id = uuidv4();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: event.text });
      writer.write({ type: "text-end", id });
      break;
    }

    case "tool_call": {
      ensureStep(writer, state);
      const toolCallId = event.toolUseId ?? uuidv4();
      writer.write({
        type: "tool-input-start",
        toolCallId,
        toolName: event.name,
        dynamic: true,
      });
      writer.write({
        type: "tool-input-delta",
        toolCallId,
        inputTextDelta: JSON.stringify(event.input),
      });
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: event.name,
        input: event.input,
        dynamic: true,
      });
      break;
    }

    case "tool_result": {
      if (event.isError) {
        writer.write({
          type: "tool-output-error",
          toolCallId: event.toolUseId,
          errorText: event.content,
          dynamic: true,
        });
      } else {
        writer.write({
          type: "tool-output-available",
          toolCallId: event.toolUseId,
          output: event.content,
          dynamic: true,
        });
      }
      // End the step after tool result — next event starts a new step
      finishStep(writer, state);
      break;
    }

    case "result": {
      finishStep(writer, state);
      writer.write({ type: "finish", finishReason: "stop" });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Collect UIMessage parts from events for DB persistence
// ---------------------------------------------------------------------------

export function collectPart(event: ClaudeStreamEvent, parts: unknown[]): void {
  switch (event.type) {
    case "thinking":
      parts.push({ type: "reasoning", text: event.text, state: "done" });
      break;

    case "assistant":
      parts.push({ type: "text", text: event.text, state: "done" });
      break;

    case "tool_call": {
      const toolCallId = event.toolUseId ?? uuidv4();
      parts.push({
        type: "dynamic-tool",
        toolCallId,
        toolName: event.name,
        state: "input-available",
        input: event.input,
      });
      break;
    }

    case "tool_result": {
      // Find the matching tool part and update it (search from end)
      let toolPart: any = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i] as any;
        if (p.toolCallId === event.toolUseId && p.type === "dynamic-tool") {
          toolPart = p;
          break;
        }
      }
      if (toolPart) {
        if (event.isError) {
          toolPart.state = "output-error";
          toolPart.errorText = event.content;
        } else {
          toolPart.state = "output-available";
          toolPart.output = event.content;
        }
      }
      break;
    }
  }
}
