import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversation — NEWRA" },
      { name: "description", content: "Your NEWRA conversation: ask questions, plan your week and brainstorm ideas." },
      { property: "og:title", content: "Conversation — NEWRA" },
      { property: "og:description", content: "Your NEWRA conversation: ask questions, plan your week and brainstorm ideas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});


function ChatPage() {
  const { threadId } = useParams({ from: "/_authenticated/chat/$threadId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: threads } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_threads").select("id, title, updated_at").order("updated_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: initialMessages } = useQuery({
    queryKey: ["thread-msgs", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("id, role, parts, created_at").eq("thread_id", threadId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m): UIMessage => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        parts: (m.parts ?? []) as UIMessage["parts"],
      }));
    },
  });

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input, init) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = new Headers(init?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId,
    transport,
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages, threadId, setMessages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const newThread = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("chat_threads").insert({ user_id: u.user!.id, title: "New chat" }).select("id").single();
      if (error) throw error; return data.id as string;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["threads"] }); navigate({ to: "/chat/$threadId", params: { threadId: id } }); },
  });

  const removeThread = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("chat_threads").delete().eq("id", id); if (error) throw error; },
    onSuccess: async (_d, id) => {
      await qc.invalidateQueries({ queryKey: ["threads"] });
      if (id === threadId) {
        const { data } = await supabase.from("chat_threads").select("id").order("updated_at", { ascending: false }).limit(1);
        if (data && data[0]) navigate({ to: "/chat/$threadId", params: { threadId: data[0].id } });
        else navigate({ to: "/chat" });
      }
    },
  });

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
    qc.invalidateQueries({ queryKey: ["threads"] });
  }

  return (
    <AppShell>
      <div className="grid h-[100dvh] md:grid-cols-[260px_1fr] md:h-screen">
        <div className="hidden border-r border-border md:flex md:flex-col">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="text-sm font-medium">Conversations</span>
            <button onClick={() => newThread.mutate()} className="rounded-md p-1.5 hover:bg-secondary" aria-label="New chat">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {(threads ?? []).map((t) => (
              <div key={t.id} className={`group flex items-center gap-1 rounded-md ${t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60"}`}>
                <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex-1 truncate px-3 py-2 text-sm">
                  {t.title}
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); if (confirm("Delete this conversation?")) removeThread.mutate(t.id); }}
                  className="mr-1 rounded p-1 opacity-0 hover:bg-background group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
            {(!threads || threads.length === 0) && <p className="p-4 text-center text-xs text-muted-foreground">No conversations yet.</p>}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.length === 0 && (
                <div className="pt-10 text-center">
                  <h2 className="text-3xl font-semibold font-display">How can NEWRA help today?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Ask about coursework, plan your week, or brainstorm a project.</p>
                  <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                    {["Create a study plan for next week", "Explain backpropagation simply", "Recommend a portfolio project", "How do I prepare for finals?"].map((s) => (
                      <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 0); }} className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-secondary">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => {
                const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
                        <p className="whitespace-pre-wrap text-sm">{text}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  NEWRA is thinking…
                </div>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="border-t border-border bg-background p-4 pb-20 md:pb-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-input bg-card p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Ask NEWRA anything…"
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
