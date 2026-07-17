## Problem
The mobile bottom nav in `src/components/AppShell.tsx` only renders the first 5 items (`nav.slice(0, 5)`) — Home, Chat, Planner, Goals, Notes. Performance, People, and Profile are unreachable on mobile.

## Fix
Update the mobile nav in `src/components/AppShell.tsx`:

1. Replace the 5-item slice with a 5-slot bar: 4 primary links (Home, Chat, Planner, Notes) + a "More" button that opens a sheet/drawer with the remaining items (Goals, Performance, People, Profile).
2. The "More" trigger uses the `Menu` icon from lucide-react and shows an active state when the current route is one of the overflow items.
3. Use the existing shadcn `Sheet` component (bottom side) to list the overflow links with icon + label; tapping a link closes the sheet.
4. Also make the mobile top bar's "Sign out" area include a quick Profile link (tap avatar/name) so profile is one tap away.

No other files change. No routing, data, or backend changes.