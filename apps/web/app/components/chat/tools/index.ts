import type { ComponentType } from "react";
import { ConfirmLoopDetailsTool } from "./confirm-loop-details-tool";
import type { AnyToolPart, ToolPart, ToolProps } from "./types";

export type { AnyToolPart, ToolPart, ToolProps };

export const toolRenderMap = new Map<string, ComponentType<any>>([
  ["tool-mcp__openralph__confirm_loop_details", ConfirmLoopDetailsTool],
]);
