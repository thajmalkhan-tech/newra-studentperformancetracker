import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MessageSquare, Target, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-semibold font-display">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HomePage() {
  const { data } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const [{ count: taskCount }, { data: dueSoon }, { count: goalCount }, { data: marks }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "todo"),
        supabase.from("tasks").select("id, title, due_at, priority").eq("status", "todo").order("due_at", { ascending: true, nullsFirst: false }).limit(5),
        supabase.from("goals").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("marks").select("score, max_score, weight, subject_id, subjects(name, credits)").eq("user_id", uid ?? ""),
      ]);
      // GPA on 10-scale (weighted average pct * 10 / 100 scaled 0-10)
      let gpa = 0;
      const bySubj = new Map<string, { pct: number; credits: number }>();
      (marks ?? []).forEach((m: {score: number; max_score: number; weight: number; subject_id: string; subjects: {name: string; credits: number} | null}) => {
        const pct = (Number(m.score) / Number(m.max_score)) * 100;
        const entry = bySubj.get(m.subject_id) ?? { pct: 0, credits: Number(m.subjects?.credits ?? 3) };
        entry.pct = (entry.pct + pct * Number(m.weight)) / 2;
        bySubj.set(m.subject_id, entry);
      });
      let total = 0, wsum = 0;
      bySubj.forEach((v) => { total += (v.pct / 10) * v.credits; wsum += v.credits; });
      gpa = wsum > 0 ? total / wsum : 0;
      return { taskCount: taskCount ?? 0, dueSoon: dueSoon ?? [], goalCount: goalCount ?? 0, gpa };
    },
  });

  return (
    <AppShell>
      <PageHeader title="Welcome back" subtitle="Your study day at a glance." />
      <div className="p-6 pb-24 md:pb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Open tasks" value={data?.taskCount ?? 0} icon={Calendar} />
          <Stat label="Active goals" value={data?.goalCount ?? 0} icon={Target} />
          <Stat label="GPA" value={(data?.gpa ?? 0).toFixed(2)} hint="Weighted, 10-scale" icon={TrendingUp} />
          <Link to="/chat" className="rounded-2xl border border-border bg-primary/5 p-5 hover:bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div className="mt-3 font-medium">Ask NEWRA</div>
            <div className="mt-1 text-xs text-muted-foreground">Start a new conversation</div>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Due soon</h2>
              <Link to="/planner" className="text-xs text-primary hover:underline">Open planner</Link>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {(data?.dueSoon ?? []).map((t: {id: string; title: string; due_at: string | null; priority: string}) => (
                <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <span>{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.due_at ? new Date(t.due_at).toLocaleDateString() : "No date"}</span>
                </li>
              ))}
              {(!data || data.dueSoon.length === 0) && <li className="py-6 text-center text-sm text-muted-foreground">No tasks yet. Add one in the planner.</li>}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Study tip</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Spaced repetition beats cramming. Ask NEWRA to build you a review schedule for anything you're learning this week.
            </p>
            <Link to="/chat" className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">Plan my week</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
