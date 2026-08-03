import Link from "next/link";
import StatusBadge, { ConflictBadge } from "@/components/StatusBadge";
import { fleetSnapshot } from "@/lib/bookings";
import { formatDateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Fleet Rentals" };

function Stat({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="card card-pad">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const snap = await fleetSnapshot(now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Today at a glance</h1>
          <p className="muted">{formatDateTime(now)}</p>
        </div>
        <Link href="/bookings/new" className="btn-primary">
          + New booking
        </Link>
      </div>

      {snap.overdue.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="font-semibold text-rose-800">
            {snap.overdue.length} rental{snap.overdue.length === 1 ? "" : "s"} past the return time
          </p>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {snap.overdue.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="font-medium underline underline-offset-2">
                  {b.car.name} — {b.customerName}
                </Link>{" "}
                was due {relativeTime(b.endAt, now)} ({formatDateTime(b.endAt)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Out right now" value={`${snap.outNow.length} / ${snap.cars.length}`} tone="emerald" />
        <Stat label="Free all day today" value={snap.availableToday.length} tone="blue" />
        <Stat label="Pickups today" value={snap.pickupsToday.length} />
        <Stat label="Returns today" value={snap.returnsToday.length} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="section-title">Rented out right now</h2>
            <span className="muted">{snap.outNow.length}</span>
          </div>
          {snap.outNow.length === 0 ? (
            <p className="muted px-4 py-6 sm:px-5">Every car is in the lot.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {snap.outNow.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="block px-4 py-3 hover:bg-slate-50 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{b.car.name}</p>
                      <div className="flex items-center gap-2">
                        {b.conflictOverride && <ConflictBadge />}
                        <StatusBadge status={b.status} short />
                      </div>
                    </div>
                    <p className="muted mt-0.5">
                      {b.customerName} · {b.customerPhone}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Due back {formatDateTime(b.endAt)}{" "}
                      <span className={b.endAt < now ? "font-semibold text-rose-600" : "text-slate-400"}>
                        ({relativeTime(b.endAt, now)})
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="section-title">Available today</h2>
            <Link href="/availability" className="text-sm font-medium text-slate-600 underline underline-offset-2">
              Check a date range
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {snap.cars.map((car) => {
              const free = snap.availableToday.some((c) => c.id === car.id);
              const outNow = snap.outNowIds.has(car.id);
              return (
                <li key={car.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p className="font-medium text-slate-900">{car.name}</p>
                    <p className="muted">
                      {car.make} {car.model}
                    </p>
                  </div>
                  {free ? (
                    <span className="badge bg-emerald-100 text-emerald-800 ring-emerald-600/20">Available</span>
                  ) : outNow ? (
                    <span className="badge bg-slate-900 text-white ring-slate-900/20">Out now</span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-900 ring-amber-600/30">Booked today</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title border-b border-slate-200 px-4 py-3 sm:px-5">Pickups today</h2>
          {snap.pickupsToday.length === 0 ? (
            <p className="muted px-4 py-6 sm:px-5">Nothing scheduled to go out today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {snap.pickupsToday.map((b) => (
                <li key={b.id} className="px-4 py-3 sm:px-5">
                  <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 hover:underline">
                    {b.car.name}
                  </Link>
                  <p className="muted">
                    {b.customerName} · out {formatDateTime(b.startAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="section-title border-b border-slate-200 px-4 py-3 sm:px-5">Returns today</h2>
          {snap.returnsToday.length === 0 ? (
            <p className="muted px-4 py-6 sm:px-5">No cars due back today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {snap.returnsToday.map((b) => (
                <li key={b.id} className="px-4 py-3 sm:px-5">
                  <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 hover:underline">
                    {b.car.name}
                  </Link>
                  <p className="muted">
                    {b.customerName} · due {formatDateTime(b.endAt)}
                    {b.endKm == null && " · ending km not entered"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
