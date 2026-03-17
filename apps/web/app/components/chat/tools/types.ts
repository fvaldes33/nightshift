import type { NightshiftMessage } from "@openralph/backend/tools/index";

export type ToolPart = Extract<NightshiftMessage["parts"][number], { type: `tool-${string}` }>;
