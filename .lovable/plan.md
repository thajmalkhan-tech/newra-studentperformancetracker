Rename the app brand from "Sage" to "THE NEW COLLEGE" everywhere it appears in the UI.

## Changes

1. `src/components/AppShell.tsx`
   - Desktop sidebar header brand (line ~53): `Sage` → `THE NEW COLLEGE`
   - Mobile top bar brand: `Sage` → `THE NEW COLLEGE`

2. `src/routes/index.tsx` (landing page)
   - Header logo text: `Sage` → `THE NEW COLLEGE`
   - Footer copyright: `© {year} Sage.` → `© {year} THE NEW COLLEGE.`

3. `src/routes/__root.tsx`
   - Update page `<title>` / meta description / og:title if they reference "Sage" so the browser tab and social preview match the new name.

No changes to routes, data, or logic. Logo icon (BookOpen) stays. If you'd prefer a shorter display like "The New College" (mixed case) instead of all-caps, say the word and I'll adjust.