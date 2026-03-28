import {
  CompactTool,
  CompactToolContent,
  CompactToolDetail,
  CompactToolEntry,
  CompactToolIcon,
  CompactToolName,
  CompactToolStatus,
} from "@openralph/ui/ai/compact-tool";
import { ToolInput, ToolOutput } from "@openralph/ui/ai/tool";
import {
  BotIcon,
  FileDiffIcon,
  FileIcon,
  FilePenIcon,
  FolderSearchIcon,
  SearchCodeIcon,
  SearchIcon,
  TerminalIcon,
  ZapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnyToolPart } from "./types";

export const COMPACT_TOOL_NAMES = new Set([
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Grep",
  "Glob",
  "Skill",
  "ToolSearch",
  "Agent",
]);

function resolveToolName(part: AnyToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace("tool-", "");
}

export function isCompactToolPart(part: AnyToolPart): boolean {
  return COMPACT_TOOL_NAMES.has(resolveToolName(part));
}

const descriptionExtractors = new Map<
  string,
  (input: Record<string, unknown>) => string
>([
  ["Bash", (input) => `$ ${String(input.command ?? "")}`],
  ["Read", (input) => String(input.file_path ?? "")],
  ["Write", (input) => String(input.file_path ?? "")],
  ["Edit", (input) => String(input.file_path ?? "")],
  [
    "Grep",
    (input) => {
      const pattern = String(input.pattern ?? "");
      const path = input.path ? ` in ${String(input.path)}` : "";
      return `"${pattern}"${path}`;
    },
  ],
  ["Glob", (input) => String(input.pattern ?? "")],
  ["Skill", (input) => String(input.skill ?? "")],
  ["ToolSearch", (input) => String(input.query ?? "")],
  ["Agent", (input) => String(input.description ?? "")],
]);

const toolIcons = new Map<string, LucideIcon>([
  ["Bash", TerminalIcon],
  ["Read", FileIcon],
  ["Write", FilePenIcon],
  ["Edit", FileDiffIcon],
  ["Grep", SearchIcon],
  ["Glob", FolderSearchIcon],
  ["Skill", ZapIcon],
  ["ToolSearch", SearchCodeIcon],
  ["Agent", BotIcon],
]);

export function CompactToolRenderer({ part }: { part: AnyToolPart }) {
  const toolName = resolveToolName(part);
  const Icon = toolIcons.get(toolName);
  const extractor = descriptionExtractors.get(toolName);
  const input = part.input as Record<string, unknown> | undefined;
  const description = extractor && input ? extractor(input) : "";
  const output =
    "output" in part && part.output !== undefined ? part.output : undefined;

  return (
    <CompactTool>
      <CompactToolEntry>
        <CompactToolIcon>{Icon && <Icon />}</CompactToolIcon>
        {description ? (
          <CompactToolDetail>{description}</CompactToolDetail>
        ) : (
          <CompactToolName>{toolName}</CompactToolName>
        )}
        <CompactToolStatus state={part.state} />
      </CompactToolEntry>
      <CompactToolContent>
        <ToolInput input={part.input} />
        <ToolOutput output={output} errorText={part.errorText} />
      </CompactToolContent>
    </CompactTool>
  );
}
