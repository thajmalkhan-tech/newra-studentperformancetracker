import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askNote, generateQuiz, getNote, summarizeNote } from "@/lib/notes.functions";
import { useState } from "react";
import { ArrowLeft, Loader2, Send, Sparkle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  component: NoteDetail,
});

function NoteDetail() {
  const { noteId } = useParams({ from: "/_authenticated/notes/$noteId" });
  const get = useServerFn(getNote);
  const ask = useServerFn(askNote);
  const quiz = useServerFn(generateQuiz);
  const summarize = useServerFn(summarizeNote);
  const qc = useQueryClient();

  const { data: note } = useQuery({ queryKey: ["note", noteId], queryFn: () => get({ data: { id: noteId } }) });

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

  return (
    <AppShell>
      <div className="p-6 pb-24 md:pb-6">
        <Link to="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All notes</Link>
        <h1 className="text-2xl font-semibold font-display">{note?.title ?? "Loading…"}</h1>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
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


        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
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

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Practice quiz</h2>
            <button onClick={() => { setRevealed({}); quizM.mutate(); }} disabled={quizM.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {quizM.isPending ? "Generating…" : "Generate quiz"}
            </button>
          </div>
          {quizM.data && quizM.data.questions.length > 0 && (
            <ol className="mt-4 space-y-4">
              {quizM.data.questions.map((q, i) => (
                <li key={i} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{i + 1}. {q.q}</p>
                  <div className="mt-2 grid gap-1.5">
                    {q.choices.map((c, ci) => {
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
    </AppShell>
  );
}
