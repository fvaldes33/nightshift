import type { ComponentType } from "react";
import { RunExplorationTool } from "./run-exploration-tool";
import { StartLoopTool } from "./start-loop-tool";
import type { ToolPart, ToolProps } from "./types";

export type { ToolPart, ToolProps };

export const toolRenderMap = new Map<string, ComponentType<any>>([
  ["tool-run_exploration", RunExplorationTool],
  ["tool-start_loop", StartLoopTool],
]);
