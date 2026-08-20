import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, Phone, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — NEWRA" },
      { name: "description", content: "Manage your personal and contact details, and your NEWRA account." },
      { property: "og:title", content: "Profile — NEWRA" },
      { property: "og:description", content: "Manage your personal and contact details, and your NEWRA account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});


type ProfileForm = {
  full_name: string;
  avatar_url: string;
  phone: string;
  date_of_birth: string;
  institution: string;
  program: string;
  year_of_study: string;
  location: string;
  contact_email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};

const EMPTY: ProfileForm = {
  full_name: "",
  avatar_url: "",
  phone: "",
  date_of_birth: "",
  institution: "",
  program: "",
  year_of_study: "",
  location: "",
  contact_email: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const deleteFn = useServerFn(deleteMyAccount);

  const del = useMutation({
    mutationFn: async () => { await deleteFn({}); },
    onSuccess: async () => {
      toast.success("Account deleted");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone, date_of_birth, institution, program, year_of_study, location, contact_email, address, emergency_contact_name, emergency_contact_phone")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, profile: p, roles: (roles ?? []).map((r) => r.role) };
    },
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        full_name: data.profile.full_name ?? "",
        avatar_url: data.profile.avatar_url ?? "",
        phone: data.profile.phone ?? "",
        date_of_birth: data.profile.date_of_birth ?? "",
        institution: data.profile.institution ?? "",
        program: data.profile.program ?? "",
        year_of_study: data.profile.year_of_study ?? "",
        location: data.profile.location ?? "",
        contact_email: data.profile.contact_email ?? "",
        address: data.profile.address ?? "",
        emergency_contact_name: data.profile.emergency_contact_name ?? "",
        emergency_contact_phone: data.profile.emergency_contact_phone ?? "",
      });
    }
  }, [data?.profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.user) throw new Error("Not signed in");
      const payload = {
        user_id: data.user.id,
        ...form,
        date_of_birth: form.date_of_birth || null,
        avatar_url: form.avatar_url || null,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (form.full_name || data?.user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <PageHeader title="Profile" subtitle="Your personal details." />
      <div className="p-6 pb-24 md:pb-6">
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="mx-auto max-w-3xl space-y-6"
        >
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{data?.user?.email}</div>
                <div className="text-xs text-muted-foreground">{data?.roles?.join(", ") || "student"}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="flex items-center gap-2 font-medium"><User className="h-4 w-4" /> Personal details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
              </Field>
              <Field label="Avatar URL">
                <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} className={input} placeholder="https://…" />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={input} />
              </Field>
              <Field label="Year of study">
                <input value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} className={input} placeholder="e.g. 2nd year" />
              </Field>
              <Field label="Institution">
                <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} className={input} />
              </Field>
              <Field label="Program / Major">
                <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className={input} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4" /> Contact details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contact email">
                <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={input} placeholder="you@example.com" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
              </Field>
              <Field label="Location">
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={input} placeholder="City, Country" />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} placeholder="Street, area, postcode" />
              </Field>
              <Field label="Emergency contact name">
                <input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} className={input} />
              </Field>
              <Field label="Emergency contact phone">
                <input value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} className={input} />
              </Field>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <div className="mx-auto mt-8 max-w-3xl">
          <section id="danger-zone" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
            <h2 className="flex items-center gap-2 font-medium text-destructive"><Trash2 className="h-4 w-4" /> Danger zone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="mt-4 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Delete account
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm">Type <span className="font-mono font-semibold">DELETE</span> to confirm.</p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className={input}
                  placeholder="DELETE"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={confirmText !== "DELETE" || del.isPending}
                    onClick={() => del.mutate()}
                    className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {del.isPending ? "Deleting…" : "Permanently delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDelete(false); setConfirmText(""); }}
                    className="rounded-md border border-input px-4 py-2 text-sm hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
