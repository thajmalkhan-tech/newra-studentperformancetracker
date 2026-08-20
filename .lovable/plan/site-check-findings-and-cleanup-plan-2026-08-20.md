# Site check — findings and cleanup plan

## What I checked
- Typecheck across the app: clean, no errors.
- Public pages loaded in a real browser: landing (`/`) and sign-in (`/auth`) render with no console errors; `/home` correctly redirects to `/auth` when signed out, so the auth guard works.
- Security scan of the backend: no issues found.
- Page metadata audit of every route.

## Issues found

1. **Page titles and descriptions are shared, not per page.** Only the dashboard defines its own metadata. Landing, sign-in, chat, planner, notes, goals, performance and profile all inherit the same title "NEWRA — Students Performance Tracker". This hurts search results, browser tabs and link previews.
2. **Signed-in pages were not verified end to end.** The preview has no active session right now, so chat, planner, notes upload/preview, goals, performance and profile were not exercised live.

## Proposed work

### A. Unique metadata per page
Add a `head()` block to each route with its own title, description, `og:title`, `og:description`, plus `og:type` and `twitter:card`:
- `/` — landing/marketing copy
- `/auth` — sign in
- `/chat`, `/chat/$threadId` — AI assistant
- `/planner` — tasks
- `/notes`, `/notes/$noteId` — study library
- `/goals`, `/performance`, `/profile`

Titles under 60 characters, descriptions under 160.

### B. Signed-in walkthrough
Sign in inside the preview (or let me mint a test session) and run a full pass: create a chat thread and send a message, add/complete a task, add a goal, add a subject and mark, upload a note and open its viewer, save profile details. Report and fix anything broken.

## Technical notes
- Metadata uses TanStack Router's route `head()` option; `__root.tsx` keeps only global defaults.
- No schema or server-function changes needed for A.
- No `og:image`/`twitter:image` will be added since there is no absolute hosted hero image; hosting supplies the preview screenshot.
