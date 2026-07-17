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

async function persistNote(opts: {
  supabase: any;
  userId: string;
  title: string;
  mime: string;
  text: string;
  storagePath?: string | null;
}) {
  const { supabase, userId, title, mime, text, storagePath } = opts;
  const { data: note, error: nerr } = await supabase
    .from("notes")
    .insert({ user_id: userId, title, mime, status: "processing", storage_path: storagePath ?? null })
    .select("id")
    .single();
  if (nerr || !note) throw new Error(nerr?.message ?? "Failed to create note");

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("Extracted text is too short to index");

  const embeddings: number[][] = [];
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embs = await embedText(batch);
    embeddings.push(...embs);
  }

  const rows = chunks.map((content, idx) => ({
    note_id: note.id,
    user_id: userId,
    chunk_index: idx,
    content,
    embedding: embeddings[idx] as unknown as string,
  }));
  const { error: cerr } = await supabase.from("note_chunks").insert(rows);
  if (cerr) throw new Error(cerr.message);

  await supabase.from("notes").update({ status: "ready" }).eq("id", note.id);
  return { id: note.id as string };
}

export const summarizeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: chunks, error } = await context.supabase
      .from("note_chunks").select("content").eq("note_id", data.id).order("chunk_index").limit(30);
    if (error) throw new Error(error.message);
    const text = (chunks ?? []).map((c) => c.content).join("\n\n").slice(0, 12000);
    if (text.length < 20) throw new Error("Not enough content to summarize");
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const { text: summary } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt: `Summarize the following study material into 5-8 bullet points capturing the key ideas a student should remember:\n\n${text}`,
    });
    await context.supabase.from("notes").update({ summary }).eq("id", data.id);
    return { summary };
  });

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function uploadOriginal(opts: {
  supabase: any;
  userId: string;
  filename: string;
  mime: string;
  base64: string;
}): Promise<string> {
  const safe = opts.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  const path = `${opts.userId}/${crypto.randomUUID()}-${safe}`;
  const bytes = base64ToBytes(opts.base64);
  const { error } = await opts.supabase.storage
    .from("notes")
    .upload(path, bytes, { contentType: opts.mime, upsert: false });
  if (error) throw new Error(`Failed to upload file: ${error.message}`);
  return path;
}

export const ingestNoteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      text: z.string().min(20).max(500000),
      mime: z.string().max(200).optional(),
      filename: z.string().min(1).max(300).optional(),
      base64: z.string().min(20).max(28_000_000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const mime = data.mime ?? "text/plain";
    let storagePath: string | null = null;
    if (data.base64 && data.filename) {
      storagePath = await uploadOriginal({
        supabase: context.supabase, userId: context.userId,
        filename: data.filename, mime, base64: data.base64,
      });
    }
    return persistNote({
      supabase: context.supabase, userId: context.userId,
      title: data.title, mime, text: data.text, storagePath,
    });
  });

export const ingestNoteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      mime: z.string().min(1).max(200),
      filename: z.string().min(1).max(300),
      base64: z.string().min(20).max(28_000_000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const apiKey = requireLovableApiKey();
    const storagePath = await uploadOriginal({
      supabase: context.supabase, userId: context.userId,
      filename: data.filename, mime: data.mime, base64: data.base64,
    });
    const dataUrl = `data:${data.mime};base64,${data.base64}`;
    const isImage = data.mime.startsWith("image/");
    const content = isImage
      ? [
          { type: "text", text: "Extract ALL readable text from this image (OCR). Preserve structure and lists. Return plain text only." },
          { type: "image_url", image_url: { url: dataUrl } },
        ]
      : [
          { type: "text", text: "Extract ALL readable text from this document. Preserve headings, lists, and tables as plain text. Return only the extracted text." },
          { type: "file", file: { filename: data.filename, file_data: dataUrl } },
        ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to extract text (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (text.length < 20) throw new Error("Could not extract enough text from this file.");

    return persistNote({
      supabase: context.supabase, userId: context.userId,
      title: data.title, mime: data.mime, text, storagePath,
    });
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
