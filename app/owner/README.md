# Owner section split into routes

## What changed

Your single `app/owner/page.tsx` (the ~1,800-line tabbed component) is now nine
route files under `app/owner/`, sharing one data layer:

```
app/owner/
├── layout.tsx              # header, theme toggle, nav (as real <Link>s), loading gate
├── OwnerDataContext.tsx     # replaces loadAll()/loadFlags() — fetches once, shared by every tab
├── types.ts                 # Employee/Booking/Payment/etc. interfaces + shared constants
├── ownerStyles.ts            # ROLE_COLORS/STATUS_COLORS/inputStyle/formatCurrency/etc.
├── overviewHelpers.ts        # date-range math, computeStats, chart buckets, stay mix (Overview only)
├── page.tsx                  # Overview  → /owner
├── bookings/page.tsx         # → /owner/bookings
├── payments/page.tsx         # → /owner/payments
├── employees/page.tsx        # → /owner/employees
├── receivers/page.tsx        # → /owner/receivers
├── expenses/page.tsx         # → /owner/expenses
├── redflags/page.tsx         # → /owner/redflags
├── checklist/page.tsx        # → /owner/checklist
└── calendar/page.tsx         # → /owner/calendar
```

Drop this whole `app/owner/` folder into your repo, replacing the old
`app/owner/page.tsx`. No new API routes are needed — everything still calls
your existing `/api/owner/redflags`, `/api/owner/checklist`, and
`/api/invite-employee` routes, and reads/writes the same Supabase tables
(`Property`, `Booking`, `Payment`, `User`, `ExpenseNote`, `Receiver`).

## Why a context instead of per-page fetching

Bookings, payments, employees, and expenses feed the Overview leaderboard and
stats, but are also needed on the Bookings/Payments/Employees/Expenses pages.
`OwnerDataProvider` (in `OwnerDataContext.tsx`) does the one Supabase fetch on
mount — same query shape as your old `loadAll()` — and every route under
`/owner` reads from it via `useOwnerData()`. Navigating between tabs is now an
instant client-side route change with no refetch and no loading flash. Calling
`reloadAll()` (e.g. after an invite) refreshes everyone reading from the
context.

The `Checklist` tab keeps its own local fetch, matching the original — it's
fully self-contained and doesn't feed the header or other tabs.

## Things to double check on your end

- `requireRole`, `IntegrioUser` from `@/lib/auth` and `supabase` from
  `@/lib/supabase` — paths kept identical to your original file.
- `UnitCalendar` import path kept as `@/components/ui/UnitCalendar`.
- CSS classes (`nav-in-owner`, `btn-owner`, `pnav-owner`, `seg-owner`,
  `earn-owner`, `chart-owner`, `staymix-owner`, `member-row-owner`,
  `chip-select-owner`, `alerts-owner`, `exp-owner`, etc.) aren't redefined
  here — they're assumed to already live in your global CSS, exactly as
  before.
- The old component briefly showed the Employees "+ Invite" button and the
  Overview period-nav in the shared title row, conditional on `activeTab`.
  Since each tab is its own route now, those controls moved into
  `employees/page.tsx` and `page.tsx` (Overview) respectively — the shared
  `layout.tsx` title row is generic across all tabs.
