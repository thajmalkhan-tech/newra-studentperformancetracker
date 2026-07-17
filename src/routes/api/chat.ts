import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { z } from "zod";

const BodySchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.any()),
  system: z.string().optional(),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        const raw = await request.json();
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { id: threadId, messages, system } = parsed.data;

        // Verify user and thread ownership via Supabase (RLS)
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data: thread } = await supabase.from("chat_threads").select("id").eq("id", threadId).maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Persist the last user message
        const lastUser = [...messages].reverse().find((m: UIMessage) => m.role === "user");
        if (lastUser) {
          await supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: lastUser.parts ?? [],
          });
        }

        const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
        const model = gateway("google/gemini-2.5-flash");

        const systemPrompt =
          system ??
          [
            "You are Sage, a warm, focused study advisor for students.",
            "Help with academics, planning, career, and general well-being (not medical advice).",
            "Be concise, practical, and encouraging. Use markdown, short lists, and worked examples.",
          ].join(" ");

        const result = streamText({
          model,
          system: systemPrompt,
          messages: convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          onFinish: async ({ responseMessage }) => {
            try {
              await supabase.from("chat_messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                parts: responseMessage.parts ?? [],
              });
              await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
            } catch (e) {
              console.error("persist assistant message failed", e);
            }
          },
        });
      },
    },
  },
});
