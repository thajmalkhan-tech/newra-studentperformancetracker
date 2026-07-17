import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/performance")({
  component: Performance,
});

type Subject = { id: string; name: string; code: string | null; credits: number };
type Mark = { id: string; subject_id: string; assessment: string; score: number; max_score: number; weight: number; recorded_at: string };

function Performance() {
  const qc = useQueryClient();

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name, code, credits").order("name");
      if (error) throw error; return data as Subject[];
    },
  });

  const { data: marks } = useQuery({
    queryKey: ["marks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marks").select("id, subject_id, assessment, score, max_score, weight, recorded_at").order("recorded_at");
      if (error) throw error; return data as Mark[];
    },
  });

  const [newSubject, setNewSubject] = useState({ name: "", code: "", credits: "3" });
  const addSubject = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("subjects").insert({ user_id: u.user!.id, name: newSubject.name, code: newSubject.code || null, credits: Number(newSubject.credits) || 3 });
      if (error) throw error;
    },
    onSuccess: () => { setNewSubject({ name: "", code: "", credits: "3" }); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });

  const [newMark, setNewMark] = useState({ subject_id: "", assessment: "", score: "", max_score: "100", weight: "1" });
  const addMark = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("marks").insert({
        user_id: u.user!.id,
        subject_id: newMark.subject_id,
        assessment: newMark.assessment,
        score: Number(newMark.score),
        max_score: Number(newMark.max_score) || 100,
        weight: Number(newMark.weight) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewMark({ subject_id: "", assessment: "", score: "", max_score: "100", weight: "1" }); qc.invalidateQueries({ queryKey: ["marks"] }); },
  });

  const removeMark = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("marks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marks"] }),
  });

  const updateSubject = useMutation({
    mutationFn: async (s: { id: string; name: string; code: string | null; credits: number }) => {
      const { error } = await supabase.from("subjects").update({ name: s.name, code: s.code, credits: s.credits }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });

  const removeSubject = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", code: "", credits: "3" });


  // Compute per-subject weighted percentage
  const rows = (subjects ?? []).map((s) => {
    const rel = (marks ?? []).filter((m) => m.subject_id === s.id);
    const totalWeight = rel.reduce((a, m) => a + Number(m.weight), 0) || 1;
    const pct = rel.reduce((a, m) => a + (Number(m.score) / Number(m.max_score)) * 100 * Number(m.weight), 0) / totalWeight;
    const gp = (pct / 10);
    return { ...s, pct: isFinite(pct) ? pct : 0, gp: isFinite(gp) ? gp : 0, count: rel.length };
  });
  const totalCredits = rows.reduce((a, r) => a + Number(r.credits), 0);
  const gpa = totalCredits > 0 ? rows.reduce((a, r) => a + r.gp * Number(r.credits), 0) / totalCredits : 0;

  // Trend: overall pct by date
  const trend = (marks ?? []).map((m) => ({ date: m.recorded_at.slice(5), pct: (Number(m.score) / Number(m.max_score)) * 100 }));

  return (
    <AppShell>
      <PageHeader title="Performance" subtitle="Log assessments, watch trends, and see your GPA update." />
      <div className="p-6 pb-24 md:pb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">GPA (10-scale)</div>
            <div className="mt-2 text-4xl font-semibold font-display">{gpa.toFixed(2)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{totalCredits} credits across {rows.length} subjects</div>
          </div>
          <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-medium">Assessment trend</div>
            <div className="mt-3 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--color-muted-foreground)" domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-medium">Subjects</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (newSubject.name.trim()) addSubject.mutate(); }} className="mb-4 flex flex-wrap gap-2">
              <input value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="Subject name" className="flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} placeholder="Code" className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={newSubject.credits} onChange={(e) => setNewSubject({ ...newSubject, credits: e.target.value })} placeholder="Credits" className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <button className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" /></button>
            </form>
            <ul className="divide-y divide-border">
              {rows.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{s.name} {s.code && <span className="text-xs text-muted-foreground">({s.code})</span>}</div>
                    <div className="text-xs text-muted-foreground">{s.count} marks · {s.credits} credits</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{s.pct.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">GP {s.gp.toFixed(2)}</div>
                  </div>
                </li>
              ))}
              {rows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No subjects yet.</li>}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-medium">Add a mark</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (newMark.subject_id && newMark.assessment && newMark.score) addMark.mutate(); }} className="mb-4 grid gap-2 md:grid-cols-2">
              <select value={newMark.subject_id} onChange={(e) => setNewMark({ ...newMark, subject_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select subject</option>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={newMark.assessment} onChange={(e) => setNewMark({ ...newMark, assessment: e.target.value })} placeholder="Assessment (e.g. Midterm)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={newMark.score} onChange={(e) => setNewMark({ ...newMark, score: e.target.value })} placeholder="Score" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={newMark.max_score} onChange={(e) => setNewMark({ ...newMark, max_score: e.target.value })} placeholder="Max" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={newMark.weight} onChange={(e) => setNewMark({ ...newMark, weight: e.target.value })} placeholder="Weight" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <button className="col-span-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Add mark</button>
            </form>
            <ul className="divide-y divide-border">
              {(marks ?? []).slice(-8).reverse().map((m) => {
                const s = subjects?.find((x) => x.id === m.subject_id);
                return (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{m.assessment} · {s?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(m.recorded_at).toLocaleDateString()} · w{m.weight}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{m.score}/{m.max_score}</div>
                      <button onClick={() => removeMark.mutate(m.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
