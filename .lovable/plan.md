## Goal

On the Performance page, turn the Subjects list into collapsible subject folders. Each subject becomes a folder button; expanding it reveals that subject's marks and an "Add mark" form scoped to it. Removes the shared "Add a mark" section at the bottom (subject is implicit per folder).

## Changes — `src/routes/_authenticated/performance.tsx`

### Layout
- Each subject row becomes a folder header (button) with: chevron icon, name (+ code), mark count, weighted % and GP on the right, plus the existing Edit / Delete icons.
- Clicking the header toggles the folder open. Local `useState<Record<string, boolean>>` keyed by subject id; default all collapsed.
- When open, the folder body shows:
  - A compact "Add mark" form: assessment, score, max (default 100), weight (default 1), Add button. `subject_id` is fixed to that folder.
  - A list of that subject's marks (assessment, date, weight, score/max, delete icon). Sorted newest first.
  - Empty state: "No marks yet."

### State
- Replace the single `newMark` state with a per-subject draft map: `Record<string, { assessment: string; score: string; max_score: string; weight: string }>`. Helper to read/update by subject id.
- `addMark` mutation takes the subject id + draft, resets that folder's draft on success.

### Removed
- The standalone "Add a mark" section and the "Recent marks" list under it (their functionality now lives inside each folder).

### Kept as-is
- Subjects create form at the top of the card, subject edit/delete, GPA/trend cards, all queries and mutations for `subjects` and `marks`, all RLS-backed data flow.

## Not changed
- Database schema, RLS, `notes` section — no migrations.

## Out of scope
- Drag-to-reorder subjects, bulk mark import.
