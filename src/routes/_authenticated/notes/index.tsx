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
  const ingestFile = useServerFn(ingestNoteFile);
  const remove = useServerFn(deleteNote);

  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: () => list({}) });

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|html?|log|rtf)$/i;

  async function fileToBase64(f: File): Promise<string> {
    const buf = new Uint8Array(await f.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function handleFile(f: File) {
    const cleanTitle = f.name.replace(/\.[^.]+$/, "");
    const isTextLike = f.type.startsWith("text/") || TEXT_EXT.test(f.name);
    if (isTextLike) {
      const t = await f.text();
      const base64 = await fileToBase64(f);
      setTitle(cleanTitle);
      setText(t);
      setOpen(true);
      // Kick off ingest immediately so the original file is saved for study view.
      try {
        setUploading(true);
        const res = await ingest({
          data: {
            title: cleanTitle, text: t,
            mime: f.type || "text/plain",
            filename: f.name, base64,
          },
        });
        toast.success("Note indexed");
        qc.invalidateQueries({ queryKey: ["notes"] });
        setOpen(false);
        nav({ to: "/notes/$noteId", params: { noteId: res.id } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
      return;
    }
    try {
      setUploading(true);
      toast.info("Extracting text from your file…");
      const base64 = await fileToBase64(f);
      const res = await ingestFile({
        data: { title: cleanTitle, mime: f.type || "application/octet-stream", filename: f.name, base64 },
      });
      toast.success("Note indexed");
      qc.invalidateQueries({ queryKey: ["notes"] });
      setOpen(false);
      nav({ to: "/notes/$noteId", params: { noteId: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
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
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm hover:bg-secondary ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Extracting…" : "Upload file (PDF, DOCX, image, text…)"}
                <input type="file" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
                <button
                  onClick={() => {
                    if (confirm(`Delete "${n.title}"? This cannot be undone.`)) del.mutate(n.id);
                  }}
                  aria-label="Delete note"
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
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
