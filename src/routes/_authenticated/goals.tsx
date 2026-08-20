import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — NEWRA" },
      { name: "description", content: "Set academic goals, track progress, and stay on target with NEWRA." },
      { property: "og:title", content: "Goals — NEWRA" },
      { property: "og:description", content: "Set academic goals, track progress, and stay on target with NEWRA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Goals,
});


type Goal = { id: string; title: string; description: string | null; target_date: string | null; progress: number; status: "active"|"completed"|"paused" };

function Goals() {
  const qc = useQueryClient();
  const { data: goals } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id, title, description, target_date, progress, status").order("created_at", { ascending: false });
      if (error) throw error; return data as Goal[];
    },
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("goals").insert({ user_id: u.user!.id, title, description: desc || null, target_date: target || null });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setDesc(""); setTarget(""); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  const update = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const status = progress >= 100 ? "completed" : "active";
      const { error } = await supabase.from("goals").update({ progress, status }).eq("id", id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("goals").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <AppShell>
      <PageHeader title="Goals" subtitle="Set the big rocks and track your progress." />
      <div className="p-6 pb-24 md:pb-6">
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }} className="mb-6 grid gap-2 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal (e.g., Crack DSA)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Why does it matter?" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button type="submit" className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add</button>
        </form>

        <div className="grid gap-3 md:grid-cols-2">
          {(goals ?? []).map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{g.title}</h3>
                  {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  {g.target_date && <p className="mt-1 text-xs text-muted-foreground">By {new Date(g.target_date).toLocaleDateString()}</p>}
                </div>
                <button onClick={() => remove.mutate(g.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{g.progress}%</span></div>
                <input type="range" min={0} max={100} value={g.progress} onChange={(e) => update.mutate({ id: g.id, progress: Number(e.target.value) })} className="mt-1 w-full accent-primary" />
                {g.status === "completed" && <p className="mt-2 text-xs text-primary">Completed 🎉</p>}
              </div>
            </div>
          ))}
          {(!goals || goals.length === 0) && <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No goals yet. What do you want to achieve this semester?</div>}
        </div>
      </div>
    </AppShell>
  );
}
