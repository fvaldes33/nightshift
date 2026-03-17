import type { ComponentType } from "react";
import { RunExplorationTool } from "./run-exploration-tool";
import type { ToolPart } from "./types";

export type { ToolPart };

export const toolRenderMap = new Map<string, ComponentType<{ part: ToolPart }>>([
  ["tool-run_exploration", RunExplorationTool],
]);
