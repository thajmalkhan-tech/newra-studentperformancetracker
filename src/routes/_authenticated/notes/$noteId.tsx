import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askNote, deleteNote, generateQuiz, getNote, summarizeNote } from "@/lib/notes.functions";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, Send, Sparkle, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  component: NoteDetail,
});

function NoteDetail() {
  const { noteId } = useParams({ from: "/_authenticated/notes/$noteId" });
  const nav = useNavigate();
  const get = useServerFn(getNote);
  const ask = useServerFn(askNote);
  const quiz = useServerFn(generateQuiz);
  const summarize = useServerFn(summarizeNote);
  const removeFn = useServerFn(deleteNote);
  const qc = useQueryClient();

  const { data: note } = useQuery({ queryKey: ["note", noteId], queryFn: () => get({ data: { id: noteId } }) });

  const deleteM = useMutation({
    mutationFn: async () => removeFn({ data: { id: noteId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["notes"] });
      nav({ to: "/notes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summarizeM = useMutation({
    mutationFn: async () => summarize({ data: { id: noteId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["note", noteId] }),
  });

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const askM = useMutation({
    mutationFn: async () => ask({ data: { noteId, question } }),
    onSuccess: (r) => setAnswer(r.answer),
  });

  const quizM = useMutation({
    mutationFn: async () => quiz({ data: { noteId, count: 6 } }),
  });
  const [revealed, setRevealed] = useState<Record<number, number>>({});

  const mime = note?.mime ?? "";
  const fileUrl = note?.file_url ?? null;
  const downloadUrl = note?.download_url ?? fileUrl;
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");
  const isTextish = mime.startsWith("text/") || /json|xml|yaml|markdown|csv/.test(mime);
  const canPreview = isImage || isPdf || isAudio || isVideo || isTextish;
  const needsBlobPreview = Boolean(fileUrl && (isImage || isPdf || isAudio || isVideo));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: previewBlob, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["note-file-preview", noteId, fileUrl, mime],
    enabled: needsBlobPreview,
    queryFn: async () => {
      if (!fileUrl) throw new Error("No file to preview");
      const res = await fetch(fileUrl, { headers: { Accept: mime || "*/*" } });
      if (!res.ok) throw new Error("Could not load file preview");
      const blob = await res.blob();
      return mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
    },
  });

  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  const { data: textContent, isLoading: textLoading } = useQuery({
    queryKey: ["note-text", noteId, fileUrl],
    enabled: Boolean(fileUrl && isTextish),
    queryFn: async () => {
      const res = await fetch(fileUrl!);
      if (!res.ok) throw new Error("Could not load file");
      return (await res.text()).slice(0, 500000);
    },
  });

  return (
    <AppShell>
      <div className="p-6 pb-24 md:pb-6">
        <Link to="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All notes</Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold font-display">{note?.title ?? "Loading…"}</h1>
          <button
            onClick={() => {
              if (confirm(`Delete "${note?.title ?? "this note"}"? This cannot be undone.`)) deleteM.mutate();
            }}
            disabled={deleteM.isPending || !note}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            {deleteM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
          </button>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Study viewer */}
          <section className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" /> Document</h2>
              {fileUrl && (
                canPreview ? (
                  <a href={isTextish ? fileUrl : previewUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={!isTextish && !previewUrl}>
                    Open in new tab
                  </a>
                ) : (
                  <a href={downloadUrl ?? fileUrl} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary">
                    <Download className="h-3 w-3" /> Download
                  </a>
                )
              )}
            </div>
            <div className="h-[70vh] overflow-hidden rounded-xl bg-secondary/40">
              {!fileUrl ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {note ? "No original file for this note." : "Loading…"}
                </div>
              ) : needsBlobPreview && previewLoading ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
                </div>
              ) : needsBlobPreview && previewError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p>This file cannot be previewed inline.</p>
                  <a href={downloadUrl ?? fileUrl} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Download</a>
                </div>
              ) : isImage && previewUrl ? (
                <img src={previewUrl} alt={note?.title ?? ""} className="h-full w-full object-contain" />
              ) : isPdf && previewUrl ? (
                <iframe src={previewUrl} title={note?.title ?? "Document"} className="h-full w-full border-0" />
              ) : isTextish ? (
                <div className="h-full overflow-auto p-4">
                  {textLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{textContent ?? "Could not load file."}</pre>
                  )}
                </div>
              ) : isAudio && previewUrl ? (
                <div className="flex h-full items-center justify-center p-6"><audio src={previewUrl} controls className="w-full" /></div>
              ) : isVideo && previewUrl ? (
                <video src={previewUrl} controls className="h-full w-full bg-black" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p>Preview not available for this file type.</p>
                  <a href={downloadUrl ?? fileUrl} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Download</a>
                </div>
              )}
            </div>
          </section>


          {/* Study tools */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium"><Sparkle className="h-4 w-4 text-primary" /> Summary</h2>
                <button onClick={() => summarizeM.mutate()} disabled={summarizeM.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {summarizeM.isPending ? "Summarizing…" : note?.summary ? "Regenerate summary" : "Summarize"}
                </button>
              </div>
              {note?.summary ? (
                <div className="prose prose-sm mt-3 max-w-none"><ReactMarkdown>{note.summary}</ReactMarkdown></div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No summary yet. Click Summarize to generate one.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-medium">Ask about this note</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (question.trim()) askM.mutate(); }} className="flex gap-2">
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g., What are the main assumptions?" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <button disabled={askM.isPending} className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50">
                  {askM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              {answer && (
                <div className="mt-4 rounded-lg bg-secondary/60 p-4">
                  <div className="prose prose-sm max-w-none"><ReactMarkdown>{answer}</ReactMarkdown></div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Practice quiz</h2>
                <button onClick={() => { setRevealed({}); quizM.mutate(); }} disabled={quizM.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {quizM.isPending ? "Generating…" : "Generate quiz"}
                </button>
              </div>
              {quizM.data?.questions && quizM.data.questions.length > 0 && (
                <ol className="mt-4 space-y-4">
                  {quizM.data.questions.map((q, i) => (
                    <li key={i} className="rounded-lg border border-border p-4">
                      <p className="font-medium">{i + 1}. {q?.q}</p>
                      <div className="mt-2 grid gap-1.5">
                        {(q?.choices ?? []).map((c, ci) => {
                          const isRevealed = revealed[i] !== undefined;
                          const isCorrect = ci === q.answer;
                          const chosen = revealed[i] === ci;
                          return (
                            <button
                              key={ci}
                              onClick={() => setRevealed((r) => ({ ...r, [i]: ci }))}
                              className={`rounded-md border px-3 py-2 text-left text-sm ${
                                !isRevealed ? "border-input hover:bg-secondary" :
                                isCorrect ? "border-primary bg-primary/10 text-primary" :
                                chosen ? "border-destructive bg-destructive/10 text-destructive" : "border-input opacity-60"
                              }`}
                            >
                              {String.fromCharCode(65 + ci)}. {c}
                            </button>
                          );
                        })}
                      </div>
                      {revealed[i] !== undefined && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
