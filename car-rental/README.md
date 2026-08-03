# Fleet Rentals — staff console

Internal booking and fleet management for a 6-car rental company. Staff sign in and
manage bookings, km-overage billing, availability and the schedule. There is no
public-facing side and no customer signup.

Built with **Next.js 16 (App Router) + React 19 + Prisma + SQLite + Tailwind CSS 4**.

---

## Run it locally

Requires Node 20+ (developed on Node 22).

```bash
cd car-rental
cp .env.example .env      # optional: edit the admin email/password and AUTH_SECRET
npm install
npm run setup             # generates the Prisma client, creates the DB, seeds fleet + admin
npm run dev               # http://localhost:3000
```

Sign in with the seeded admin account:

| Email                 | Password   |
| --------------------- | ---------- |
| `admin@rentals.local` | `admin123` |

**Change that password after the first login** (Staff → Reset password), and set a real
`AUTH_SECRET` in `.env` before running anywhere other than your own machine.

### Other commands

| Command          | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `npm run dev`    | Dev server with hot reload                                        |
| `npm run build`  | Production build                                                  |
| `npm run start`  | Serve the production build                                        |
| `npm run seed`   | Re-seed fleet/settings/admin (safe to re-run — everything upserts) |
| `npm test`       | Unit tests for the billing maths                                  |
| `npm run typecheck` | TypeScript check                                               |
| `npm run db:studio` | Browse the database in Prisma Studio                           |

Reset everything: `rm prisma/dev.db && npm run setup`.

---

## What's in it

- **Auth** — email + password login, bcrypt hashes, signed session cookie (HTTP-only,
  12h). Every page under the app shell and every API route checks the session; there is
  no signup route.
- **Dashboard** — what's out right now, what's free all day today, today's pickups and
  returns, and a red banner for rentals past their return time.
- **Bookings** — create / edit / delete, filter by car, status and customer. Quick
  actions to change status and to record the return odometer.
- **Km overage billing** — 200 free km per rental day, $1.00 per extra km (both
  configurable, see below).
- **Availability checker** — the booking form checks the selected car and dates live and
  warns before you can double-book.
- **Calendar** — month grid colour-coded by status, filterable by car, with an agenda
  list on phones.
- **Availability page** — pick a date range, see which of the 6 cars are free vs taken.
- **Staff management** — admins create/remove staff accounts, reset passwords and
  promote/demote. Staff can manage bookings; only admins can change rates and accounts.

Mobile-friendly throughout: the nav collapses to a menu, tables become cards, and the
calendar becomes an agenda.

---

## How the billing works

All of it lives in one file — [`src/lib/billing.ts`](src/lib/billing.ts) — and every
page, API route and test calls the same `computeBilling()`:

```
rental days   = ceil(end − start ÷ 24h), minimum 1     e.g. 1 day 3 hours → 2 days
free km       = rental days × freeKmPerDay             (200/day by default)
km driven     = ending km − starting km
overage km    = max(0, km driven − free km)
overage $     = overage km × overageRatePerKm          ($1.00/km by default)
base charge   = flat price override, or daily rate × rental days
total         = base charge + overage $
```

The booking page shows every line of that breakdown. Until the ending km is entered,
the km lines and the total read **"pending return"** — no total is ever guessed.

**Guards:** ending km must be ≥ starting km, the end date/time must be after the start,
and a booking can't be marked *Returned* without an ending km. All three are enforced
in the browser and again server-side in [`src/lib/validation.ts`](src/lib/validation.ts).

### Changing the rates

The 200 km/day allowance, the $1.00/km rate, the default daily rate and the currency are
**settings, not literals**. Defaults live in
[`src/lib/config.ts`](src/lib/config.ts) (`DEFAULT_SETTINGS`) and are written into a
single-row `Setting` table on first run. An admin can change them at runtime on the
**Settings** page — no code change, no redeploy. Charges are always derived on read, so
changing a rate updates existing bookings' breakdowns too.

---

## Double-booking

Overlap is half-open: a rental that starts exactly when another ends does **not**
conflict. Cancelled bookings never hold a car; Reserved, Active and Returned do.

When you pick a car and dates, the form checks availability as you type and shows any
overlapping bookings. Saving over a conflict is refused (HTTP 409) unless you explicitly
confirm — and a booking saved that way is stored with `conflictOverride: true` and
carries a **"Double-booked"** badge on the dashboard, the bookings list and its own page,
so an intentional overlap is never invisible.

To make overlaps impossible instead, drop the confirm path: in
`src/app/api/bookings/route.ts` and `src/app/api/bookings/[id]/route.ts`, return the 409
without checking `allowConflict`.

---

## Data model

`prisma/schema.prisma`:

- **User** — `id, email (unique), name, passwordHash, role (ADMIN|STAFF), timestamps`
- **Car** — `id, slug (unique), name, make, model, color, plate?, active, sort`
  — the fixed 6-car fleet, seeded; staff don't create cars
- **Booking** — `id, carId → Car, customerName, customerPhone, startAt, endAt,
  startKm, endKm?, dailyRate, priceOverride?, notes?, status
  (RESERVED|ACTIVE|RETURNED|CANCELLED), conflictOverride, createdById → User?, timestamps`
- **Setting** — single row: `freeKmPerDay, overageRatePerKm, defaultDailyRate, currency`

Charges are never stored — they're derived from the booking plus the current settings.

### Switching to Postgres

Change `provider` to `"postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at
your database, and run `npx prisma db push && npm run seed`. No application code changes.

---

## Folder structure

```
car-rental/
├── prisma/
│   ├── schema.prisma          # data model
│   ├── seed.ts                # 6 cars + admin account + settings row
│   └── dev.db                 # SQLite file (gitignored)
├── src/
│   ├── app/
│   │   ├── login/             # sign-in page (outside the app shell)
│   │   ├── (app)/             # everything behind auth
│   │   │   ├── layout.tsx     # session guard + nav shell
│   │   │   ├── dashboard/
│   │   │   ├── bookings/      # list, new, [id] detail, [id]/edit
│   │   │   ├── calendar/
│   │   │   ├── availability/
│   │   │   ├── settings/
│   │   │   └── users/         # admin only
│   │   ├── api/               # auth, bookings, availability, settings, users, cars
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/            # AppShell, BookingForm, BookingActions,
│   │                          # BillingBreakdown, StatusBadge, SettingsForm, UsersManager
│   └── lib/
│       ├── billing.ts         # ← all overage maths
│       ├── billing.test.ts
│       ├── config.ts          # ← DEFAULT_SETTINGS, statuses, colours
│       ├── validation.ts      # zod schemas shared by every route
│       ├── bookings.ts        # conflict + availability + dashboard queries
│       ├── settings.ts        # reads/writes the Setting row
│       ├── auth.ts            # hashing, session cookie, page/API guards
│       ├── format.ts          # money, km and date formatting
│       └── db.ts              # Prisma client singleton
└── README.md
```

## API

All routes require a session cookie; the ones marked *admin* require `role = ADMIN`.

| Method             | Route                  | Purpose                                        |
| ------------------ | ---------------------- | ---------------------------------------------- |
| `POST`             | `/api/auth/login`      | Sign in                                        |
| `POST`             | `/api/auth/logout`     | Sign out                                       |
| `GET` `POST`       | `/api/bookings`        | List / create (409 on overlap)                 |
| `GET` `PATCH` `DELETE` | `/api/bookings/:id` | Read / update (409 on overlap) / delete       |
| `POST`             | `/api/availability`    | Conflicts for one car, or the whole fleet      |
| `GET`              | `/api/cars`            | The fleet                                      |
| `GET` `PUT`        | `/api/settings`        | Read / update rates (*admin* to write)         |
| `GET` `POST`       | `/api/users`           | List / create staff (*admin*)                  |
| `PATCH` `DELETE`   | `/api/users/:id`       | Update / remove staff (*admin*)                |

## Notes

- Dates are shown in the server's timezone. For a fixed office timezone, set `TZ` in
  `.env` (e.g. `TZ="America/New_York"`).
- The last remaining admin account can't be deleted or demoted, and you can't delete the
  account you're signed in with.
- Deleting a staff member keeps their bookings; the "created by" link is just cleared.
