import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAssignRole, adminLinkStudent, adminListLinks, adminListUsers, adminUnlink, listMyLinkedStudents, meWithRoles } from "@/lib/people.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/people")({
  component: People,
});

const ROLES = ["student", "parent", "faculty", "admin"] as const;
type Role = (typeof ROLES)[number];

function People() {
  const me = useServerFn(meWithRoles);
  const linked = useServerFn(listMyLinkedStudents);
  const listUsers = useServerFn(adminListUsers);
  const assign = useServerFn(adminAssignRole);
  const link = useServerFn(adminLinkStudent);
  const unlink = useServerFn(adminUnlink);
  const listLinks = useServerFn(adminListLinks);
  const qc = useQueryClient();

  const { data: whoami } = useQuery({ queryKey: ["me-roles"], queryFn: () => me() });
  const isAdmin = whoami?.roles.includes("admin");

  const { data: myLinked } = useQuery({ queryKey: ["my-links"], queryFn: () => linked() });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers(), enabled: !!isAdmin });
  const { data: links } = useQuery({ queryKey: ["admin-links"], queryFn: () => listLinks(), enabled: !!isAdmin });

  const setRole = useMutation({
    mutationFn: async (v: { user_id: string; role: Role; grant: boolean }) => assign({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [linkForm, setLinkForm] = useState<{ student_id: string; viewer_id: string; relation: "parent" | "faculty" }>({ student_id: "", viewer_id: "", relation: "parent" });
  const createLink = useMutation({
    mutationFn: async () => link({ data: linkForm }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-links"] }); toast.success("Linked"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeLink = useMutation({
    mutationFn: async (id: string) => unlink({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-links"] }),
  });

  const nameFor = (id: string) => users?.find((u) => u.user_id === id)?.full_name ?? id.slice(0, 8);

  return (
    <AppShell>
      <PageHeader title="People" subtitle={isAdmin ? "Manage users, roles, and student links." : "The people who can view your progress."} />
      <div className="p-6 pb-24 md:pb-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">Students you can view</h2>
          <ul className="divide-y divide-border">
            {(myLinked ?? []).map((l) => {
              const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
              return (
                <li key={l.student_id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p?.full_name ?? l.student_id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{l.relation}</span>
                </li>
              );
            })}
            {(!myLinked || myLinked.length === 0) && <li className="py-6 text-center text-sm text-muted-foreground">No linked students yet.</li>}
          </ul>
        </section>

        {isAdmin && (
          <>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-medium">Users & roles</h2>
              <ul className="divide-y divide-border">
                {(users ?? []).map((u) => (
                  <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.map((r) => {
                        const has = u.roles.includes(r);
                        return (
                          <button key={r} onClick={() => setRole.mutate({ user_id: u.user_id, role: r, grant: !has })}
                            className={`rounded-md px-2 py-1 text-xs ${has ? "bg-primary text-primary-foreground" : "border border-input hover:bg-secondary"}`}>
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-medium">Student links</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (linkForm.student_id && linkForm.viewer_id) createLink.mutate(); }} className="mb-4 grid gap-2 md:grid-cols-4">
                <select value={linkForm.student_id} onChange={(e) => setLinkForm({ ...linkForm, student_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Student</option>
                  {(users ?? []).filter((u) => u.roles.includes("student")).map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.slice(0, 8)}</option>)}
                </select>
                <select value={linkForm.viewer_id} onChange={(e) => setLinkForm({ ...linkForm, viewer_id: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Viewer</option>
                  {(users ?? []).filter((u) => u.roles.some((r) => r === "parent" || r === "faculty")).map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.slice(0, 8)}</option>)}
                </select>
                <select value={linkForm.relation} onChange={(e) => setLinkForm({ ...linkForm, relation: e.target.value as "parent" | "faculty" })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="parent">Parent</option>
                  <option value="faculty">Faculty</option>
                </select>
                <button className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><UserPlus className="h-4 w-4" /> Link</button>
              </form>
              <ul className="divide-y divide-border">
                {(links ?? []).map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{nameFor(l.viewer_id)} <span className="text-xs text-muted-foreground">({l.relation})</span> → {nameFor(l.student_id)}</span>
                    <button onClick={() => removeLink.mutate(l.id)} className="rounded p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
                {(!links || links.length === 0) && <li className="py-6 text-center text-sm text-muted-foreground">No links yet.</li>}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
