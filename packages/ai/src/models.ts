import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createPerplexity } from "@ai-sdk/perplexity";

let anthropicInstance: ReturnType<typeof createAnthropic> | null = null;
let groqInstance: ReturnType<typeof createGroq> | null = null;
let openaiInstance: ReturnType<typeof createOpenAI> | null = null;
let perplexityInstance: ReturnType<typeof createPerplexity> | null = null;

export function createAnthropicLLM() {
  if (anthropicInstance) return anthropicInstance;
  const apiKey = process.env.ANTHROPIC_API_KEY_LOCAL;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY_LOCAL environment variable");
  anthropicInstance = createAnthropic({ apiKey });
  return anthropicInstance;
}

export function createGroqLLM() {
  if (groqInstance) return groqInstance;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable");
  groqInstance = createGroq({ apiKey });
  return groqInstance;
}

export function createOpenAILLM() {
  if (openaiInstance) return openaiInstance;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY environment variable");
  openaiInstance = createOpenAI({ apiKey });
  return openaiInstance;
}

export function createPerplexityLLM() {
  if (perplexityInstance) return perplexityInstance;
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("Missing PERPLEXITY_API_KEY environment variable");
  perplexityInstance = createPerplexity({ apiKey });
  return perplexityInstance;
}
