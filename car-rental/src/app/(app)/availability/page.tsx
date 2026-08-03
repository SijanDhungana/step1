import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { rentalDays } from "@/lib/billing";
import { fleetAvailability } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { formatDateTime, toDateInput } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Availability — Fleet Rentals" };

type Search = Promise<{ from?: string; to?: string }>;

/** "2026-08-05" (+ optional time) -> local Date, or null. */
function parseLocal(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  return endOfDay ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0);
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Search }) {
  const { from, to } = await searchParams;

  const today = new Date();
  const defaultFrom = toDateInput(today);
  const defaultTo = toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

  const startAt = parseLocal(from) ?? parseLocal(defaultFrom)!;
  const endAt = parseLocal(to, true) ?? parseLocal(defaultTo, true)!;
  const rangeValid = endAt > startAt;

  const settings = await getSettings();
  const fleet = rangeValid ? await fleetAvailability(startAt, endAt) : [];
  const carsCount = rangeValid ? fleet.length : await prisma.car.count({ where: { active: true } });
  const freeCount = fleet.filter((row) => row.available).length;
  const days = rentalDays(startAt, endAt);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Availability</h1>
        <p className="muted">Pick a period and see which of the {carsCount} cars are free.</p>
      </div>

      <form action="/availability" className="card card-pad grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" className="input" defaultValue={from ?? defaultFrom} required />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" className="input" defaultValue={to ?? defaultTo} required />
        </div>
        <button type="submit" className="btn-primary">
          Check
        </button>
      </form>

      {!rangeValid ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          The &ldquo;to&rdquo; date must be on or after the &ldquo;from&rdquo; date.
        </p>
      ) : (
        <>
          <div className="card card-pad">
            <p className="text-sm text-slate-600">
              {formatDateTime(startAt)} → {formatDateTime(endAt)}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {freeCount} of {fleet.length} cars free for the whole period
            </p>
            <p className="muted mt-1">
              A rental over this period would count as {days} {days === 1 ? "day" : "days"} ={" "}
              {days * settings.freeKmPerDay} free km.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fleet.map(({ car, available, bookings }) => (
              <div
                key={car.id}
                className={`card card-pad ${available ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{car.name}</p>
                    <p className="muted">
                      {car.make} {car.model}
                    </p>
                  </div>
                  {available ? (
                    <span className="badge bg-emerald-100 text-emerald-800 ring-emerald-600/20">Free</span>
                  ) : (
                    <span className="badge bg-rose-100 text-rose-700 ring-rose-600/20">Taken</span>
                  )}
                </div>

                {available ? (
                  <Link href="/bookings/new" className="btn-secondary mt-3 w-full">
                    Book this car
                  </Link>
                ) : (
                  <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                    {bookings.map((b) => (
                      <li key={b.id}>
                        <Link href={`/bookings/${b.id}`} className="block hover:underline">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">{b.customerName}</span>
                            <StatusBadge status={b.status} short />
                          </div>
                          <span className="muted">
                            {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
