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
  BookOpenIcon,
  FileDiffIcon,
  FileIcon,
  FilePenIcon,
  FolderSearchIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  ListTodoIcon,
  MessageSquareIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchCodeIcon,
  SearchIcon,
  SettingsIcon,
  TerminalIcon,
  UploadIcon,
  ZapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnyToolPart } from "./types";

export const COMPACT_TOOL_NAMES = new Set([
  // Claude Code tools
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Grep",
  "Glob",
  "Skill",
  "ToolSearch",
  "Agent",
  // MCP tools
  "mcp__openralph__list_tasks",
  "mcp__openralph__get_task",
  "mcp__openralph__create_task",
  "mcp__openralph__update_task",
  "mcp__openralph__add_task_comment",
  "mcp__openralph__create_message",
  "mcp__openralph__list_loops",
  "mcp__openralph__get_loop",
  "mcp__openralph__update_loop",
  "mcp__openralph__list_docs",
  "mcp__openralph__get_doc",
  "mcp__openralph__get_session",
  "mcp__openralph__confirm_loop_details",
  "mcp__openralph__push_changes",
  "mcp__openralph__create_pull_request",
  "mcp__openralph__handoff_worktree",
]);

function resolveToolName(part: AnyToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace("tool-", "");
}

export function isCompactToolPart(part: AnyToolPart): boolean {
  return COMPACT_TOOL_NAMES.has(resolveToolName(part));
}

/** Pretty display names for tool log entries */
const displayNames = new Map<string, string>([
  // MCP tools
  ["mcp__openralph__list_tasks", "List Tasks"],
  ["mcp__openralph__get_task", "Get Task"],
  ["mcp__openralph__create_task", "Create Task"],
  ["mcp__openralph__update_task", "Update Task"],
  ["mcp__openralph__add_task_comment", "Add Comment"],
  ["mcp__openralph__create_message", "Create Message"],
  ["mcp__openralph__list_loops", "List Loops"],
  ["mcp__openralph__get_loop", "Get Loop"],
  ["mcp__openralph__update_loop", "Update Loop"],
  ["mcp__openralph__list_docs", "List Docs"],
  ["mcp__openralph__get_doc", "Get Doc"],
  ["mcp__openralph__get_session", "Get Session"],
  ["mcp__openralph__confirm_loop_details", "Confirm Loop"],
  ["mcp__openralph__push_changes", "Push Changes"],
  ["mcp__openralph__create_pull_request", "Create PR"],
  ["mcp__openralph__handoff_worktree", "Handoff Worktree"],
]);

export function getDisplayName(toolName: string): string {
  return displayNames.get(toolName) ?? toolName;
}

export const descriptionExtractors = new Map<
  string,
  (input: Record<string, unknown>) => string
>([
  // Claude Code tools
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
  // MCP tools — show the key identifier from input
  ["mcp__openralph__get_task", (input) => String(input.id ?? "")],
  ["mcp__openralph__create_task", (input) => String(input.title ?? "")],
  ["mcp__openralph__update_task", (input) => String(input.title ?? input.id ?? "")],
  ["mcp__openralph__add_task_comment", (input) => String(input.body ?? "").slice(0, 60)],
  ["mcp__openralph__get_loop", (input) => String(input.id ?? "")],
  ["mcp__openralph__update_loop", (input) => String(input.name ?? input.id ?? "")],
  ["mcp__openralph__get_doc", (input) => String(input.id ?? "")],
  ["mcp__openralph__get_session", (input) => String(input.id ?? "")],
  ["mcp__openralph__confirm_loop_details", (input) => String(input.name ?? "")],
  ["mcp__openralph__create_pull_request", (input) => String(input.title ?? "")],
]);

export const toolIcons = new Map<string, LucideIcon>([
  // Claude Code tools
  ["Bash", TerminalIcon],
  ["Read", FileIcon],
  ["Write", FilePenIcon],
  ["Edit", FileDiffIcon],
  ["Grep", SearchIcon],
  ["Glob", FolderSearchIcon],
  ["Skill", ZapIcon],
  ["ToolSearch", SearchCodeIcon],
  ["Agent", BotIcon],
  // MCP tools
  ["mcp__openralph__list_tasks", ListTodoIcon],
  ["mcp__openralph__get_task", ListTodoIcon],
  ["mcp__openralph__create_task", ListTodoIcon],
  ["mcp__openralph__update_task", ListTodoIcon],
  ["mcp__openralph__add_task_comment", MessageSquareIcon],
  ["mcp__openralph__create_message", MessageSquareIcon],
  ["mcp__openralph__list_loops", RefreshCwIcon],
  ["mcp__openralph__get_loop", RefreshCwIcon],
  ["mcp__openralph__update_loop", SettingsIcon],
  ["mcp__openralph__list_docs", BookOpenIcon],
  ["mcp__openralph__get_doc", BookOpenIcon],
  ["mcp__openralph__get_session", PlayIcon],
  ["mcp__openralph__confirm_loop_details", PlayIcon],
  ["mcp__openralph__push_changes", UploadIcon],
  ["mcp__openralph__create_pull_request", GitPullRequestIcon],
  ["mcp__openralph__handoff_worktree", GitBranchIcon],
]);

export function CompactToolRenderer({ part }: { part: AnyToolPart }) {
  const toolName = resolveToolName(part);
  const label = getDisplayName(toolName);
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
          <CompactToolName>{label}</CompactToolName>
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
