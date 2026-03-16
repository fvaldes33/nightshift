import { embed, embedMany } from "ai";
import { createOpenAILLM } from "./models";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export async function generateEmbedding(content: string): Promise<number[]> {
  const openai = createOpenAILLM();
  const result = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: content,
    providerOptions: {
      openai: {
        dimensions: EMBEDDING_DIMENSIONS,
      },
    },
  });
  return result.embedding;
}

export async function generateEmbeddings(contents: string[]): Promise<number[][]> {
  const openai = createOpenAILLM();
  const result = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: contents,
    providerOptions: {
      openai: {
        dimensions: EMBEDDING_DIMENSIONS,
      },
    },
  });
  return result.embeddings;
}
