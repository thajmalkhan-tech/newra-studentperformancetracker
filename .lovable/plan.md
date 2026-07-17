
# Student Personal Advisor — v1 Plan

A student-focused AI companion with threaded chat, a smart planner, a learning assistant that answers from uploaded notes, and performance tracking. Signed-in users; data stored in Lovable Cloud. Multi-role: student, parent/mentor, faculty, admin.

## Scope (v1)

**In**
- Auth (email/password + Google) with roles: `student`, `parent`, `faculty`, `admin`
- Threaded AI Chat with per-thread history
- Learning Assistant: upload PDFs/notes → summarize, quiz, ask questions (RAG)
- Smart Planner: tasks, deadlines, goals, priorities, simple reminders in-app
- Performance: subjects, marks entry, GPA/CGPA, strengths/weaknesses, dashboard
- Role dashboards (read-only for parent/faculty over linked students; admin manages users/links)

**Deferred (v2+, called out so we don't scope-creep):** voice, multilingual, OCR handwriting, email/SMS reminders, calendar sync, Pomodoro, resume review, interview prep, wellness check-ins, faculty grading workflows.

## Design direction

Warm, focused study aesthetic — not generic AI purple. Custom identity mark (not Sparkles). AI Elements for chat surface. I'll generate 3 directions before building the shell.

## App structure

```text
/                       landing + sign-in CTA (public)
/auth                   sign in / sign up
/_authenticated
  /home                 role-aware dashboard
  /chat                 redirects to newest thread or creates one
  /chat/$threadId       threaded AI chat
  /planner              tasks, deadlines, goals
  /notes                upload + library
  /notes/$noteId        summary, quiz, chat-with-note
  /performance          subjects, marks, GPA, analytics
  /goals                goal tracker
  /people               parent/faculty: linked students; admin: users
  /settings             profile, role, linked accounts
```

## Data model (Lovable Cloud / Postgres)

- `profiles(user_id pk, full_name, avatar_url, created_at)`
- `app_role` enum: `student|parent|faculty|admin`
- `user_roles(user_id, role)` + `has_role()` SECURITY DEFINER
- `student_links(student_id, viewer_id, relation)` — parent/faculty ↔ student
- `chat_threads(id, user_id, title, updated_at)`
- `chat_messages(id, thread_id, role, parts jsonb, created_at)`
- `notes(id, user_id, title, storage_path, mime, created_at)`
- `note_chunks(id, note_id, content, embedding vector(1536))` — pgvector, HNSW
- `tasks(id, user_id, title, due_at, priority, status, goal_id null)`
- `goals(id, user_id, title, target_date, progress)`
- `subjects(id, user_id, name, credits)`
- `marks(id, subject_id, assessment, score, max_score, weight, recorded_at)`

RLS: everything scoped by `auth.uid()`; parent/faculty read via `student_links`; admin via `has_role`. GRANTs to `authenticated` + `service_role` on every table.

Storage: private bucket `notes` — users read/write own paths.

## AI wiring (Lovable AI Gateway via AI SDK)

- Chat: `/api/chat` server route, `streamText`, model `google/gemini-3.5-flash` (fast default)
- Learning Assistant Q&A: RAG — embed chunks with `google/gemini-embedding-001`, retrieve top-k, stream answer
- Summaries/quiz generation: `createServerFn` with structured output (Zod, clamped in code)
- Server-only `LOVABLE_API_KEY`; provider helper in `src/lib/ai-gateway.server.ts`

## Chat UI

AI Elements (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`), threads in sidebar, per-thread route, message parts rendering, textarea auto-focus, persist assistant messages in `onFinish`.

## Role dashboards

- Student: today's tasks, upcoming deadlines, GPA snapshot, recent chats, goal progress
- Parent/Mentor: pick a linked student → read-only view of their performance + goals
- Faculty: same read-only view over linked students (linking managed by admin)
- Admin: manage users, assign roles, create student ↔ viewer links

## Technical notes

- TanStack Start file routes under `src/routes/_authenticated/`
- Managed auth gate (`_authenticated/route.tsx`) ships with Cloud
- Server functions for all DB writes; `requireSupabaseAuth` middleware
- PDF text extraction server-side (pdfjs) → chunk → embed → insert
- Rewrite `src/routes/index.tsx` (currently the template placeholder) into the landing page

## Build order

1. Enable Lovable Cloud, configure Google OAuth
2. Migrations: profiles, roles, links, tasks/goals/subjects/marks, chat, notes + pgvector
3. Auth pages + role bootstrap (new signups default to `student`)
4. Design directions → pick one → apply tokens in `src/styles.css`
5. App shell, landing, role-aware `/home`
6. Threaded chat (`/chat`, `/chat/$threadId`) with AI Elements + streaming
7. Planner (tasks, goals) with server fns
8. Notes upload + RAG (summarize, quiz, chat-with-note)
9. Performance (subjects, marks, GPA calc, charts)
10. Parent/faculty/admin dashboards
11. QA pass: auth flows, RLS, thread isolation, focus behavior

## What I won't do without you asking

Email/SMS reminders, calendar integrations, voice, OCR, wellness check-ins, payments, mobile app.
