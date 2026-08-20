import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI assistant — NEWRA" },
      { name: "description", content: "Chat with NEWRA about coursework, study plans and project ideas." },
      { property: "og:title", content: "AI assistant — NEWRA" },
      { property: "og:description", content: "Chat with NEWRA about coursework, study plans and project ideas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {

    const { data: threads } = await supabase.from("chat_threads").select("id").order("updated_at", { ascending: false }).limit(1);
    if (threads && threads[0]) throw redirect({ to: "/chat/$threadId", params: { threadId: threads[0].id } });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: created, error } = await supabase.from("chat_threads").insert({ user_id: u.user.id, title: "New chat" }).select("id").single();
    if (error || !created) throw new Error(error?.message ?? "Could not create thread");
    throw redirect({ to: "/chat/$threadId", params: { threadId: created.id } });
  },
  component: () => null,
});
