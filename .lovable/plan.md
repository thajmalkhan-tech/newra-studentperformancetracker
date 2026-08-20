# Get NEWRA fully working again

## What's actually wrong

Sign-in is not a code bug. Your hosted database and auth service are currently **paused**, so every request from the app fails before it reaches anything:

- Sign-in and sign-up requests to the auth service fail with "Failed to fetch"
- Session refresh retries loop in the background (the repeated console errors)
- Chat, notes, planner, goals and performance would also fail, because they all read the same backend

I confirmed the paused state directly, and an automatic resume attempt failed on the platform side just now.

## Steps

1. Retry resuming the hosted backend (repeat with short waits until it reports healthy). If it keeps refusing, the next step is a restart of the backend instance.
2. Once healthy, confirm auth and database reachability: a live auth call plus a read of the core tables (profiles, chat_threads, notes, tasks, goals, subjects, marks).
3. Sign in as a real test user in the browser and walk the whole app:
   - Sign in / sign up + password visibility toggle
   - Home dashboard (GPA, upcoming tasks)
   - Chat: create thread, send message, streamed reply, delete thread
   - Notes: upload a file, view it inline, summarize, ask a question, quiz, delete
   - Planner: add task, change status
   - Goals: add goal, update progress
   - Performance: add subject, expand it, add mark
   - Profile: personal + contact details save, and sign out
4. Fix any real defects found during that walkthrough (each reported back with what broke and what changed).
5. Add a friendly "service temporarily unavailable" state so a paused or unreachable backend shows a clear message on the sign-in page instead of a raw fetch error, plus stop the endless silent retry loop.

## Technical notes

- Backend recovery uses the Cloud status/resume/restart controls; no schema change is involved.
- Step 5 touches only presentation: catch network-level failures (`TypeError: Failed to fetch`) in the sign-in and sign-up handlers in `src/routes/auth.tsx` and surface a distinct message, rather than the generic error toast.
- No changes to auth configuration, RLS policies or the data model are planned.
