import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { BOOKING_STATUSES, STATUS_LABELS, STATUS_STYLES, type BookingStatus } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar — Fleet Rentals" };

type Search = Promise<{ month?: string; car?: string }>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-08" -> first instant of that month, falling back to the current month. */
function monthStartFrom(value: string | undefined): Date {
  const now = new Date();
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return new Date(now.getFullYear(), now.getMonth(), 1);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(year, month, 1);
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const { month, car: carFilter } = await searchParams;

  const monthStart = monthStartFrom(month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  // Pad out to whole weeks so the grid is rectangular.
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(monthEnd);
  if (gridEnd.getDay() !== 0) gridEnd.setDate(gridEnd.getDate() + (7 - gridEnd.getDay()));

  const [cars, bookings] = await Promise.all([
    prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.booking.findMany({
      where: {
        startAt: { lt: gridEnd },
        endAt: { gt: gridStart },
        ...(carFilter ? { carId: carFilter } : {}),
      },
      include: { car: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const days: Date[] = [];
  for (let d = new Date(gridStart); d < gridEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const bookingsOn = (day: Date) => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return bookings.filter((b) => b.startAt < dayEnd && b.endAt > dayStart);
  };

  const prev = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const linkFor = (m: Date) => `/calendar?month=${monthKey(m)}${carFilter ? `&car=${carFilter}` : ""}`;
  const today = new Date();

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthStart);
  const selectedCar = cars.find((c) => c.id === carFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedule</h1>
          <p className="muted">
            {selectedCar ? selectedCar.name : "All cars"} · {bookings.length} booking
            {bookings.length === 1 ? "" : "s"} this view
          </p>
        </div>
        <Link href="/bookings/new" className="btn-primary">
          + New booking
        </Link>
      </div>

      <div className="card card-pad flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={linkFor(prev)} className="btn-secondary" aria-label="Previous month">
            ←
          </Link>
          <span className="min-w-40 text-center text-lg font-semibold text-slate-900">{monthLabel}</span>
          <Link href={linkFor(next)} className="btn-secondary" aria-label="Next month">
            →
          </Link>
          <Link href={`/calendar${carFilter ? `?car=${carFilter}` : ""}`} className="btn-ghost">
            Today
          </Link>
        </div>

        <form action="/calendar" className="flex items-end gap-2">
          <input type="hidden" name="month" value={monthKey(monthStart)} />
          <div>
            <label className="label" htmlFor="car">
              Filter by car
            </label>
            <select id="car" name="car" defaultValue={carFilter ?? ""} className="select">
              <option value="">All cars</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        {BOOKING_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span className={`h-3 w-3 rounded ${STATUS_STYLES[s].dot}`} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>

      {/* Month grid — tablet and up */}
      <div className="card hidden overflow-hidden lg:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.getMonth() === monthStart.getMonth();
            const isToday = sameDay(day, today);
            const items = bookingsOn(day);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-28 border-r border-b border-slate-100 p-1.5 ${inMonth ? "bg-white" : "bg-slate-50/60"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-slate-900 text-white" : inMonth ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((b) => (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      title={`${b.car.name} — ${b.customerName} (${STATUS_LABELS[b.status as BookingStatus]})`}
                      className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLES[b.status as BookingStatus].bar
                      }`}
                    >
                      {carFilter ? b.customerName : b.car.name}
                    </Link>
                  ))}
                  {items.length > 3 && <p className="px-1 text-[11px] text-slate-500">+{items.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda — phones and small tablets */}
      <div className="card divide-y divide-slate-100 lg:hidden">
        <div className="px-4 py-3">
          <h2 className="section-title">{monthLabel} agenda</h2>
          <p className="muted">Bookings starting this month, in order.</p>
        </div>
        {bookings.filter((b) => b.startAt >= monthStart && b.startAt < monthEnd).length === 0 ? (
          <p className="muted px-4 py-6">No bookings start in this month.</p>
        ) : (
          bookings
            .filter((b) => b.startAt >= monthStart && b.startAt < monthEnd)
            .map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{b.car.name}</p>
                  <StatusBadge status={b.status} short />
                </div>
                <p className="muted mt-0.5">{b.customerName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                </p>
              </Link>
            ))
        )}
      </div>
    </div>
  );
}
