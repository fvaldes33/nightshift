import type { ComponentType } from "react";
import { CompactToolRenderer, COMPACT_TOOL_NAMES, isCompactToolPart } from "./compact-tool-renderers";
import { ConfirmLoopDetailsTool } from "./confirm-loop-details-tool";
import { PlanWriteTool } from "./plan-write-tool";
import type { AnyToolPart, ToolPart, ToolProps } from "./types";

export type { AnyToolPart, ToolPart, ToolProps };

const PLAN_PATH_RE = /(?:\.claude|\.nightshift)\/plans\/[^/]+\.md$/;

/** Check if a tool part is a Read/Write targeting a plan file */
export function isPlanFilePart(part: AnyToolPart): boolean {
  const toolName = part.type === "dynamic-tool" ? part.toolName : part.type.replace("tool-", "");
  if (toolName !== "Write" && toolName !== "Read") return false;
  const input = part.input as Record<string, unknown> | undefined;
  return typeof input?.file_path === "string" && PLAN_PATH_RE.test(input.file_path);
}

export { CompactToolRenderer, COMPACT_TOOL_NAMES, isCompactToolPart, PlanWriteTool };

export const toolRenderMap = new Map<string, ComponentType<any>>([
  ["tool-mcp__openralph__confirm_loop_details", ConfirmLoopDetailsTool],
]);
