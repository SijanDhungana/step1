# Fleet Rentals — staff console

Internal booking and fleet management for a 6-car rental company. Staff sign in and
manage bookings, km-overage billing, availability and the schedule. There is no
public-facing side and no customer signup.

Built with **Next.js 16 (App Router) + React 19 + Prisma + Postgres + Tailwind CSS 4**.
The database is Postgres — [Neon](https://neon.tech)'s free tier works out of the box.

---

## Run it locally

Requires Node 20+ (developed on Node 22) and a Postgres database.

### 1. Get a database (Neon, free)

1. Sign up at [neon.tech](https://neon.tech) and create a project — the free plan is
   enough for this app.
2. Open your project → **Connect**, and copy the connection string **twice**:
   - the **pooled** one (its host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one (same host without `-pooler`) → `DIRECT_URL`

   The app runs its queries through the pooled endpoint; `prisma db push` needs the
   direct one, because schema changes require a real (non-pooled) session. Keep
   `?sslmode=require` on both.

### 2. Run it

```bash
cd car-rental
cp .env.example .env      # paste your two Neon URLs, set AUTH_SECRET
npm install
npm run setup             # generates the Prisma client, creates the tables, seeds fleet + admin
npm run dev               # http://localhost:3000
```

Already have Postgres running locally? Skip step 1 and point both `DATABASE_URL` and
`DIRECT_URL` at it, e.g. `postgresql://postgres:postgres@localhost:5432/fleet`.

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

Wipe and start over: `npx prisma db push --force-reset && npm run seed`.

> **Neon free-tier notes.** The database autosuspends after ~5 minutes idle, so the
> first request after a quiet spell takes about a second while it wakes — normal, not a
> bug. The free plan keeps one project with plenty of storage for a booking app like
> this. Because the app runs on the Node runtime (not edge), the plain connection string
> is all you need; there's no reason to add `@prisma/adapter-neon`.

---

## Deploy to Vercel

Next.js + Neon is Vercel's home turf, and this app is set up for it — the build never
touches the database, so a deploy can't fail on a sleeping Neon instance.

1. **Import the repo** in Vercel → *Add New Project*.
2. **Set the Root Directory to `car-rental`.** The app lives in a subfolder of the repo;
   without this, Vercel looks at the repo root and finds no Next.js app. Everything else
   (framework preset, build command) is detected automatically.
3. **Add the environment variables** under Settings → Environment Variables:

   | Variable        | Value                                                              |
   | --------------- | ------------------------------------------------------------------ |
   | `DATABASE_URL`  | Neon **pooled** string (host contains `-pooler`) — required         |
   | `DIRECT_URL`    | Neon **direct** string — required                                   |
   | `AUTH_SECRET`   | A long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `TZ`            | Your office timezone, e.g. `America/New_York` — see the warning below |
   | `SESSION_HOURS` | Optional, defaults to 12                                            |

   The `ADMIN_*` variables aren't needed on Vercel; they're only read by the seed script,
   which you run from your machine in the next step.

4. **Create the tables and seed, once, from your machine** — point your local `.env` at
   the same Neon database and run:

   ```bash
   npx prisma db push && npm run seed
   ```

   Deploys deliberately don't do this: schema changes and seeding stay explicit actions,
   not a side effect of pushing code.

5. **Deploy.** Sign in with the seeded admin and change the password immediately.

Later schema changes follow the same shape: edit `prisma/schema.prisma`, run
`npx prisma db push` against Neon, then push your code.

> ⚠️ **Set `TZ`, or every time will be wrong.** Vercel runs in UTC. This app formats
> booking times in the server's timezone, so without `TZ` a 4 PM pickup in New York
> displays as 8 PM. Verified: with `TZ=UTC` the dashboard shows `8:20 PM`, with
> `TZ=America/New_York` the same booking shows `4:20 PM`.

> 💵 **On "free":** Neon's free tier genuinely covers this. Vercel's free **Hobby** plan
> does not — its terms limit it to non-commercial use, and an internal tool running a
> rental business is commercial, which means the Pro plan (~$20/user/month). If free
> matters more than Vercel specifically, this app is a plain Next.js server and runs
> anywhere that hosts Node — Render, Railway and Fly all have cheaper or free entry
> tiers, and `npm run build && npm run start` on any small VPS works too. Nothing in the
> code is Vercel-specific.

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

### Using SQLite instead

If you'd rather have a zero-setup local file and no hosted database:

1. In `prisma/schema.prisma`, set `provider = "sqlite"` and delete the `directUrl` line.
2. In `.env`, set `DATABASE_URL="file:./dev.db"` (`DIRECT_URL` is then unused).
3. In `src/app/(app)/bookings/page.tsx`, drop the two `mode: "insensitive"` options —
   SQLite doesn't accept them, and its `LIKE` is already case-insensitive.
4. `npx prisma db push && npm run seed`.

That third step is the only application code that differs between the two databases.

---

## Folder structure

```
car-rental/
├── prisma/
│   ├── schema.prisma          # data model
│   └── seed.ts                # 6 cars + admin account + settings row
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
  `.env` (e.g. `TZ="America/New_York"`) — and in your host's environment variables when
  deployed, since servers usually default to UTC.
- The last remaining admin account can't be deleted or demoted, and you can't delete the
  account you're signed in with.
- Deleting a staff member keeps their bookings; the "created by" link is just cleared.
