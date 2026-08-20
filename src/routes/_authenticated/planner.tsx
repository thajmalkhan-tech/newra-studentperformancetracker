import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Planner — NEWRA" },
      { name: "description", content: "Organise your tasks by status and keep your study week on track." },
      { property: "og:title", content: "Planner — NEWRA" },
      { property: "og:description", content: "Organise your tasks by status and keep your study week on track." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Planner,
});


type Status = "todo" | "doing" | "done";
type Task = { id: string; title: string; notes: string | null; due_at: string | null; priority: "low"|"medium"|"high"; status: Status };

const STATUS_LABEL: Record<Status, string> = { todo: "To do", doing: "Doing", done: "Done" };
const STATUS_STYLES: Record<Status, string> = {
  todo: "bg-secondary text-secondary-foreground",
  doing: "bg-primary/15 text-primary",
  done: "bg-muted text-muted-foreground",
};

function Planner() {
  const qc = useQueryClient();
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id, title, notes, due_at, priority, status").order("created_at", { ascending: false });
      if (error) throw error; return data as Task[];
    },
  });

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("todo");

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        user_id: u.user!.id,
        title,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setStatus("todo"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e) => toast.error(String(e)),
  });

  const setTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const groups: Record<Status, Task[]> = {
    todo: (tasks ?? []).filter((t) => t.status === "todo"),
    doing: (tasks ?? []).filter((t) => t.status === "doing"),
    done: (tasks ?? []).filter((t) => t.status === "done"),
  };

  const renderTask = (t: Task) => (
    <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button
        onClick={() => setTaskStatus.mutate({ id: t.id, status: t.status === "done" ? "todo" : "done" })}
        className={`flex h-6 w-6 items-center justify-center rounded-md border ${t.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-secondary"}`}
        aria-label="Toggle done"
      >
        {t.status === "done" && <Check className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className={`text-sm font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[t.status]}`}>{STATUS_LABEL[t.status]}</span>
      </div>
      {t.status !== "done" && (
        <select
          value={t.status}
          onChange={(e) => setTaskStatus.mutate({ id: t.id, status: e.target.value as Status })}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          aria-label="Change status"
        >
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      )}
      <button onClick={() => remove.mutate(t.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </li>
  );

  return (
    <AppShell>
      <PageHeader title="Planner" subtitle="Capture tasks and track their status." />
      <div className="p-6 pb-24 md:pb-6">
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) addTask.mutate(); }} className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Task</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Finish AI assignment" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option>
            </select>
          </div>
          <button type="submit" className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add</button>
        </form>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">To do</h2>
          <ul className="space-y-2">
            {groups.todo.map(renderTask)}
            {groups.todo.length === 0 && <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing to do. Enjoy a break.</li>}
          </ul>
        </section>

        {groups.doing.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Doing</h2>
            <ul className="space-y-2">{groups.doing.map(renderTask)}</ul>
          </section>
        )}

        {groups.done.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Done</h2>
            <ul className="space-y-2 opacity-60">{groups.done.map(renderTask)}</ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
