# Nafaqa — personal finance for irregular income

Nafaqa is a mobile-first, offline-first PWA for people who earn daily and irregularly. It always answers:
how much you have, how much you've saved, what to save **today**, what is **safe to spend**, and which bills are next.

## Run

```bash
npm install
npm run dev        # development
npm test           # financial engine + repository tests (vitest)
npm run build      # type-check + production build with service worker
npm run preview    # serve the build (installable, works offline)
```

## Architecture

| Layer | Path | Notes |
|---|---|---|
| Financial engine | `src/engine/` | Pure, framework-free, fully unit-tested. No UI code does financial math. |
| Persistence | `src/data/` | IndexedDB via Dexie. Every mutation is an atomic transaction with validation and an audit-log entry. |
| State | `src/hooks/useFinance.tsx` | Live queries → one `computeSnapshot(data, today)` per change. A clock re-evaluates the Africa/Casablanca date every 30s so targets roll over at local midnight. |
| UI | `src/ui/`, `src/features/`, `src/screens/` | React + TypeScript + Tailwind design system. |

### Financial rules

* **Money is integer centimes** everywhere; input is parsed from strings, never floats.
* **Dates** are `YYYY-MM-DD` in the Africa/Casablanca calendar (IANA tz data); weeks run Monday–Sunday.
* **Balance** = income − expenses. Transfers never change it. Opening balance counts toward balance but not income analytics.
* **Pockets** (waterfall, each dirham counted once): savings (ledger) → unallocated (ledger) → reserved bills (computed) → emergency reserve (setting) → **safe to spend** = remainder. Shortages show as a *deficit*; nothing is borrowed from savings silently, and moving money out of Spendable is capped at safe-to-spend.
* **Savings contributions** are transfers into/out of savings, attributed to exactly one date (`periodDate`), so each counts once toward its week and its month (weeks crossing months are split by date).
* **Dynamic daily target** = ⌈remaining at start of today ÷ working days left (incl. today)⌉, rounded up to whole dirhams. Rest days (manual, or recurring weekday preferences with per-date overrides) are excluded. Status: comfortable (≤ daily reference), on track (today's target met), catch-up (> reference), achieved, monthly goal achieved, insufficient working days.
* **Monthly cap**: once the monthly goal is reached nothing more is required; surplus stays spendable.
* **Weekly recovery**: after a week ends short (or on Sunday), the app suggests `min(shortfall, safe-to-spend)`. It never transfers automatically; confirming creates a transfer attributed to that week, rejecting records the shortfall.
* **Subscriptions**: renewal day is clamped to month length (Feb, 30-day months). Overdue unpaid renewals plus the next upcoming one are reserved (not expensed). Paying records the expense and the payment atomically; a unique index prevents duplicate payments. Deleting the expense re-opens the renewal. Skip / pause / reactivate supported.
* **Target history**: changing targets adds a row effective today, so past weeks and months keep their original goals.
* **Forecasts** need ≥ 14 days of history and are labelled as estimates; the health score (5 transparent components × 20 pts) is withheld until there's a week of data.

### Data entities
Accounts, transactions, transfers, allocation pockets, savings contributions (the savings side of transfers), weekly & monthly savings records, subscriptions, subscription payments, rest days, goal targets, daily snapshots, categories, settings, audit logs.

### Privacy & data
All data lives in this browser's IndexedDB. Settings provide JSON backup/restore, CSV export, "hide amounts", and full erase.
**Demo mode** uses a separate database (`nafaqa-demo`) and a persistent banner — real data is never touched.
