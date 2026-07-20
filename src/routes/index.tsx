import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Calendar, LineChart, MessageSquare, Sparkle, Target, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold font-display">THE NEW COLLEGE</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth" className="rounded-md px-3 py-2 text-sm hover:bg-secondary">Sign in</Link>
          <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Get started</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-10 md:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkle className="h-3.5 w-3.5 text-primary" /> An AI-powered study companion
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl font-display">
            The study advisor that actually knows <em className="text-primary not-italic">your</em> coursework.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Chat with an AI tutor, plan your week, learn from your own notes, and watch your GPA move —
            all in one calm, focused workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">Create your workspace</Link>
            <a href="#features" className="rounded-md border border-input bg-background px-5 py-3 text-sm font-medium hover:bg-secondary">See what's inside</a>
          </div>
        </section>

        <section id="features" className="mt-24 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={MessageSquare} title="AI Chat Assistant" body="Ask anything — from 'explain gradient descent' to 'plan my exam week'. Threads keep every conversation." />
          <Feature icon={Upload} title="Learn from your notes" body="Upload PDFs and notes. Get summaries, quizzes, and grounded answers with retrieval." />
          <Feature icon={Calendar} title="Smart Planner" body="Tasks, deadlines, priorities. Bring order to a chaotic week." />
          <Feature icon={Target} title="Goal Tracker" body="Set goals like 'crack DSA' or 'GPA 8.5'. Track progress week by week." />
          <Feature icon={LineChart} title="Performance Analytics" body="Log marks, compute GPA, and see where you're strong or slipping." />
          <Feature icon={Brain} title="Parents & Faculty" body="Read-only dashboards for the people who support you. Admins manage access." />
        </section>

        <section className="mt-24 rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-accent/20 p-10 text-center">
          <h2 className="text-3xl font-semibold font-display">Start your term the right way.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Free while in beta. No credit card. Sign in with Google in a click.</p>
          <Link to="/auth" className="mt-6 inline-flex rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">Get started</Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sage. Built for students.
      </footer>
    </div>
  );
}
