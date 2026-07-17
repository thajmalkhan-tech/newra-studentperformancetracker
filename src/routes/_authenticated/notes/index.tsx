import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotes, ingestNoteText, ingestNoteFile, deleteNote } from "@/lib/notes.functions";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: NotesIndex,
});

function NotesIndex() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useServerFn(listNotes);
  const ingest = useServerFn(ingestNoteText);
  const remove = useServerFn(deleteNote);

  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: () => list({}) });

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async () => ingest({ data: { title, text } }),
    onSuccess: (res) => {
      toast.success("Note indexed");
      qc.invalidateQueries({ queryKey: ["notes"] });
      setTitle(""); setText(""); setOpen(false);
      nav({ to: "/notes/$noteId", params: { noteId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  async function handleFile(f: File) {
    if (f.type === "text/plain" || f.name.endsWith(".txt") || f.name.endsWith(".md")) {
      const t = await f.text();
      setTitle(f.name.replace(/\.[^.]+$/, ""));
      setText(t);
      setOpen(true);
    } else {
      toast.error("For now, please paste text or upload a .txt/.md file. PDF support is coming soon.");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Notes"
        subtitle="Upload or paste notes. Sage indexes them so you can ask questions and generate quizzes."
        actions={<button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add notes</button>}
      />
      <div className="p-6 pb-24 md:pb-6">
        {open && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm hover:bg-secondary">
                <Upload className="h-4 w-4" /> Upload .txt / .md
                <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
              <span className="text-xs text-muted-foreground">or paste your notes below</span>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste your notes here…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-input px-4 py-2 text-sm">Cancel</button>
              <button disabled={create.isPending || !title.trim() || text.length < 20} onClick={() => create.mutate()} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Index & summarize
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(notes ?? []).map((n) => (
            <div key={n.id} className="group rounded-2xl border border-border bg-card p-5">
              <Link to="/notes/$noteId" params={{ noteId: n.id }} className="block">
                <div className="flex items-center gap-2 text-primary"><FileText className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">Note</span></div>
                <h3 className="mt-2 font-medium">{n.title}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{n.summary ?? (n.status === "processing" ? "Indexing…" : "Ready")}</p>
              </Link>
              <div className="mt-3 flex justify-end">
                <button onClick={() => del.mutate(n.id)} className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {(!notes || notes.length === 0) && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No notes yet. Add your first study document.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
