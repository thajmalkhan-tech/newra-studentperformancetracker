// Server-only embeddings helper using Lovable AI Gateway.
import { requireLovableApiKey } from "./ai-gateway.server";

export async function embedText(input: string | string[]): Promise<number[][]> {
  const key = requireLovableApiKey();
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding request failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
