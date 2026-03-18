import { createAnthropicLLM, createGroqLLM } from "@openralph/ai/models";
import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { AgentContext } from "../lib/context";
import { allTools } from "../tools/index";
import { getGitHubToken } from "./account.service";
import { createMessage } from "./message.service";
import { ensureWorktree, type getSession } from "./session.service";

interface StreamChatOptions {
  session: Awaited<ReturnType<typeof getSession>>;
  messages: UIMessage[];
}

export function streamChat({ session, messages }: StreamChatOptions) {
  const lastMessage = messages[messages.length - 1];

  const repo = session.repo;
  const systemPrompt = `You are nightshift, an AI coding assistant.
Repo: ${repo ? `${repo.owner}/${repo.name}` : "none"} | Branch: ${session.branch ?? "main"}

Be conversational. When the user asks you to evaluate, explore, or plan something:
1. Run your exploration, then present what you found in a clear summary.
2. Discuss your findings and recommendations with the user.
3. Wait for the user to confirm or adjust before taking action (e.g. creating tasks, writing code).

Never batch-create tasks or make sweeping changes without checking in first. Work collaboratively — the user wants to be part of the decision-making, not just handed a finished result.

You have tools to explore the repo, create and manage tasks, and work with code. Use them thoughtfully.`;

  return createUIMessageStream({
    execute: async ({ writer }) => {
      const githubToken = await getGitHubToken({});

      // Persist user message (client IDs may be nanoids — only pass if valid UUID)
      if (lastMessage) {
        try {
          const idParse = z.uuid().safeParse(lastMessage.id);
          await createMessage({
            ...(idParse.success ? { id: idParse.data } : {}),
            sessionId: session.id,
            role: lastMessage.role,
            parts: lastMessage.parts,
          });
        } catch (error) {
          console.error("[ai.service] Failed to save message:", error);
        }
      }

      // Recreate worktree if it was cleaned up
      const worktreePath = await ensureWorktree(session);

      const agentState = {
        githubToken,
        sessionId: session.id,
        repoId: session.repoId,
        repoOwner: repo?.owner ?? null,
        repoName: repo?.name ?? null,
        branch: session.branch,
        worktreePath,
      };

      const modelMessages = await convertToModelMessages(messages);

      const anthropic = createAnthropicLLM();
      const groq = createGroqLLM();
      const model =
        session.provider === "anthropic" ? anthropic(session.model) : groq(session.model);

      const result = AgentContext.with({ ...agentState, writer }, () =>
        streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          providerOptions: {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 10000 },
            },
          },
          tools: allTools,
          stopWhen: stepCountIs(10),
        }),
      );

      const existingIds = new Set(messages.map((m) => m.id));

      writer.merge(
        result.toUIMessageStream({
          generateMessageId: () => uuidv4(),
          originalMessages: messages,
          async onFinish({ messages: allMsgs }) {
            for (const msg of allMsgs) {
              // Skip messages that were already in the original conversation
              if (existingIds.has(msg.id)) continue;

              try {
                const idParse = z.uuid().safeParse(msg.id);
                await createMessage({
                  ...(idParse.success ? { id: idParse.data } : {}),
                  sessionId: session.id,
                  role: msg.role,
                  parts: msg.parts,
                });
              } catch (error) {
                console.error("[ai.service] Failed to save assistant message:", error);
              }
            }
          },
        }),
      );
    },
    onError: (error) => {
      console.error("[ai.service]", error);
      return "An error occurred while generating a response.";
    },
  });
}
