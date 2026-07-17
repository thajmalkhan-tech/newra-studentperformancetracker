## Planner UI update

Modify `src/routes/_authenticated/planner.tsx` only.

**Remove**
- Priority `<select>` from the add-task form and the `priority` state.
- Due date `<input type="datetime-local">` and `due` state.
- The "due date · priority" meta line under each task title.

**Add**
- Status `<select>` in the add-task form with options: To do, Doing, Done (default: To do). Included in the insert.
- Status badge on each task row (small pill showing current status).
- Inline status `<select>` on each open task row so users can move between `todo` / `doing` / `done` without deleting. The existing checkbox stays as a shortcut for toggling done.

**Grouping**
- Split lists into three sections: To do, Doing, Done (instead of just To do / Done).

No schema, no backend changes — `tasks.status` already supports these values.