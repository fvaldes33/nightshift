import type { NightshiftMessage } from "@openralph/backend/tools/index";
import type { DynamicToolUIPart } from "ai";

export type ToolPart = Extract<NightshiftMessage["parts"][number], { type: `tool-${string}` }>;

export type AnyToolPart = ToolPart | DynamicToolUIPart;

export interface ToolProps {
  part: ToolPart;
  messageId: string;
}
