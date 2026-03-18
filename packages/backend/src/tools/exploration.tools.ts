import { tool } from "ai";
import { z } from "zod";
import { runClaude } from "../lib/claude-runner";
import { AgentContext } from "../lib/context";

const EXPLORATION_SYSTEM = `You are a senior technical analyst conducting a structured codebase exploration. Your goal is to deeply understand the area requested and return a comprehensive, actionable report.

## Approach

1. **Scope first.** Before reading files, use Glob and Grep to map the relevant file tree and understand boundaries.
2. **Read selectively.** Only read files that are directly relevant. Don't read entire directories — target specific files based on grep/glob results.
3. **Be efficient.** You have limited turns. Prioritize breadth over depth — cover all the dimensions below rather than going deep on one area.

## Report Structure

Return your findings in this exact format:

### Overview
1-2 sentences summarizing what you found.

### Architecture
- Key files and directories involved
- How the pieces connect (data flow, imports, call chain)
- Relevant patterns, abstractions, or conventions used

### Current State
- What exists today (features, endpoints, models, UI)
- What's working vs incomplete vs broken

### Technical Notes
- Data model details (schemas, relations, migrations)
- API surface (endpoints, tRPC procedures, tools)
- Integration points with other parts of the system

### Recommendations
- Suggested approach for the work ahead
- Dependencies and ordering (what must come first)
- Risks or unknowns that need investigation
- Estimated complexity (small/medium/large per item)

### Scope Boundaries
- What's in scope based on what you found
- What's explicitly out of scope or separate work

## Rules

- Do NOT create, edit, or modify any files. This is read-only exploration.
- Do NOT run tests, builds, or destructive commands.
- Be concise. No filler. Lead with findings, not process narration.
- Reference specific file paths so the reader can navigate to them.`;

export const run_exploration = tool({
  description:
    "Spawn a Claude Code process to explore the repository and return findings. Used during planning to understand the codebase before creating tasks.",
  inputSchema: z.object({
    prompt: z.string().describe("What to explore or investigate in the repo"),
  }),
  execute: async ({ prompt }, { toolCallId }) => {
    const ctx = AgentContext.use();
    const cwd = ctx.worktreePath;
    if (!cwd) throw new Error("No worktree path available for this session");
    const { writer } = ctx;

    const fullPrompt = `${EXPLORATION_SYSTEM}\n\n---\n\n## Exploration Request\n\n${prompt}`;

    console.log(`[exploration] Starting exploration in ${cwd}`);
    console.log(`[exploration] Prompt: ${prompt.slice(0, 200)}${prompt.length > 200 ? "..." : ""}`);

    const start = Date.now();
    const partId = `exploration-${toolCallId}`;

    function writeStatus(status: "running" | "complete" | "error", toolName: string | null) {
      writer.write({
        type: "data-exploration" as any,
        id: partId,
        data: { status, tool: toolName, elapsed: Math.round((Date.now() - start) / 1000) },
        transient: true,
      });
    }

    writeStatus("running", null);

    const result = await runClaude({
      prompt: fullPrompt,
      cwd,
      timeoutSec: 300,
      args: ["--max-turns", "40"],
      onEvent: (event) => {
        if (event.type === "tool_call") {
          console.log(`[exploration] Tool: ${event.name}`);
          writeStatus("running", event.name);
        }
      },
      onLog: (line) => console.log(`[exploration] ${line}`),
    });

    const elapsed = Date.now() - start;
    writeStatus(result.error ? "error" : "complete", null);

    if (result.error) {
      console.error(`[exploration] Failed after ${elapsed}ms: ${result.error}`);
      throw new Error(`Exploration failed: ${result.error}`);
    }

    console.log(`[exploration] Completed in ${elapsed}ms`);
    if (result.usage) {
      console.log(
        `[exploration] Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`,
      );
    }

    return { result: result.summary };
  },
});
