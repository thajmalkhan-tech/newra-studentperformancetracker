import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planner")({
  component: Planner,
});

type Task = { id: string; title: string; notes: string | null; due_at: string | null; priority: "low"|"medium"|"high"; status: "todo"|"doing"|"done" };

function Planner() {
  const qc = useQueryClient();
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, title, notes, due_at, priority, status").order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error; return data as Task[];
    },
  });

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low"|"medium"|"high">("medium");

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        user_id: u.user!.id,
        title, priority,
        due_at: due ? new Date(due).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setDue(""); setPriority("medium"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e) => toast.error(String(e)),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      const { error } = await supabase.from("tasks").update({ status: status === "done" ? "todo" : "done" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const groups = {
    todo: (tasks ?? []).filter((t) => t.status !== "done"),
    done: (tasks ?? []).filter((t) => t.status === "done"),
  };

  return (
    <AppShell>
      <PageHeader title="Planner" subtitle="Capture tasks and stay on top of deadlines." />
      <div className="p-6 pb-24 md:pb-6">
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) addTask.mutate(); }} className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Task</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Finish AI assignment" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Due</label>
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as "low"|"medium"|"high")} className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <button type="submit" className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add</button>
        </form>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">To do</h2>
          <ul className="space-y-2">
            {groups.todo.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <button onClick={() => toggle.mutate({ id: t.id, status: t.status })} className="flex h-6 w-6 items-center justify-center rounded-md border border-input hover:bg-secondary" aria-label="Complete">
                  {t.status === "done" && <Check className="h-4 w-4 text-primary" />}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.due_at ? new Date(t.due_at).toLocaleString() : "No due date"} · {t.priority}
                  </div>
                </div>
                <button onClick={() => remove.mutate(t.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {groups.todo.length === 0 && <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing to do. Enjoy a break.</li>}
          </ul>
        </section>

        {groups.done.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Done</h2>
            <ul className="space-y-2 opacity-60">
              {groups.done.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <button onClick={() => toggle.mutate({ id: t.id, status: t.status })} className="flex h-6 w-6 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground"><Check className="h-4 w-4" /></button>
                  <div className="flex-1 text-sm line-through">{t.title}</div>
                  <button onClick={() => remove.mutate(t.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
