import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { embedText } from "@/lib/embeddings.server";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

const uuid = z.string().uuid();

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter((c) => c.trim().length > 30);
}

export const ingestNoteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      text: z.string().min(20).max(500000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: note, error: nerr } = await context.supabase
      .from("notes")
      .insert({ user_id: context.userId, title: data.title, mime: "text/plain", status: "processing" })
      .select("id")
      .single();
    if (nerr || !note) throw new Error(nerr?.message ?? "Failed to create note");

    const chunks = chunkText(data.text);
    if (chunks.length === 0) throw new Error("Text is too short to index");

    // Embed in batches
    const embeddings: number[][] = [];
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embs = await embedText(batch);
      embeddings.push(...embs);
    }

    const rows = chunks.map((content, idx) => ({
      note_id: note.id,
      user_id: context.userId,
      chunk_index: idx,
      content,
      embedding: embeddings[idx] as unknown as string, // pgvector accepts array; supabase-js sends JSON
    }));

    const { error: cerr } = await context.supabase.from("note_chunks").insert(rows);
    if (cerr) throw new Error(cerr.message);

    // Summary
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const { text: summary } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt: `Summarize the following study notes into 5-8 bullet points capturing the key ideas a student should remember:\n\n${data.text.slice(0, 12000)}`,
    });

    await context.supabase.from("notes").update({ summary, status: "ready" }).eq("id", note.id);
    return { id: note.id };
  });

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notes").select("id, title, summary, status, created_at").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: note, error } = await context.supabase.from("notes").select("id, title, summary, status, created_at").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return note;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const askNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ noteId: uuid, question: z.string().min(2).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const [q] = await embedText(data.question);
    const { data: matches, error } = await context.supabase.rpc("match_note_chunks", {
      _user_id: context.userId, _note_id: data.noteId, _query: q as unknown as string, _match_count: 5,
    });
    if (error) throw new Error(error.message);
    const ctx = ((matches ?? []) as {content: string}[]).map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n");
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: "You are Sage, a study tutor. Answer using ONLY the provided context. If it doesn't contain the answer, say so honestly. Cite chunk numbers like [1].",
      prompt: `Context:\n${ctx}\n\nQuestion: ${data.question}`,
    });
    return { answer: text };
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ noteId: uuid, count: z.number().int().min(3).max(15).default(6) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: chunks } = await context.supabase.from("note_chunks").select("content").eq("note_id", data.noteId).order("chunk_index").limit(12);
    const context_text = (chunks ?? []).map((c) => c.content).join("\n\n").slice(0, 12000);
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system: "Generate a study quiz. Return strict JSON: {\"questions\":[{\"q\":\"...\",\"choices\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":0,\"explanation\":\"...\"}]}. No markdown fences.",
      prompt: `Create ${data.count} multiple-choice questions from these notes:\n\n${context_text}`,
    });
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned) as { questions: { q: string; choices: string[]; answer: number; explanation: string }[] };
    } catch {
      return { questions: [] };
    }
  });
