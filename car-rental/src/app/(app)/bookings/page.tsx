import Link from "next/link";
import StatusBadge, { ConflictBadge } from "@/components/StatusBadge";
import { computeBilling } from "@/lib/billing";
import { BOOKING_STATUSES, STATUS_LABELS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDateTime, formatKm, formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings — Fleet Rentals" };

type Search = Promise<{ car?: string; status?: string; q?: string }>;

export default async function BookingsPage({ searchParams }: { searchParams: Search }) {
  const { car: carFilter, status: statusFilter, q } = await searchParams;
  const settings = await getSettings();

  const cars = await prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  const bookings = await prisma.booking.findMany({
    where: {
      ...(carFilter ? { carId: carFilter } : {}),
      ...(statusFilter && BOOKING_STATUSES.includes(statusFilter as never) ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q } },
              { customerPhone: { contains: q } },
            ],
          }
        : {}),
    },
    include: { car: true },
    orderBy: { startAt: "desc" },
    take: 300,
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { car: carFilter, status: statusFilter, q, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const s = params.toString();
    return s ? `/bookings?${s}` : "/bookings";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bookings</h1>
          <p className="muted">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"}
            {carFilter || statusFilter || q ? " matching your filters" : ""}
          </p>
        </div>
        <Link href="/bookings/new" className="btn-primary">
          + New booking
        </Link>
      </div>

      <form className="card card-pad grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end" action="/bookings">
        <div>
          <label className="label" htmlFor="car">
            Car
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
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter ?? ""} className="select">
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q">
            Customer
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} className="input" placeholder="Name or phone" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            Filter
          </button>
          {(carFilter || statusFilter || q) && (
            <Link href="/bookings" className="btn-secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      {bookings.length === 0 ? (
        <div className="card card-pad text-center">
          <p className="font-medium text-slate-800">No bookings found.</p>
          <p className="muted mt-1">Try clearing the filters, or create the first booking.</p>
          <Link href="/bookings/new" className="btn-primary mt-4">
            + New booking
          </Link>
        </div>
      ) : (
        <>
          {/* Table on tablet and up */}
          <div className="card hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Car</th>
                    <th>Customer</th>
                    <th>Period</th>
                    <th>Km</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const billing = computeBilling(b, settings);
                    return (
                      <tr key={b.id} className="cursor-pointer">
                        <td>
                          <Link href={`/bookings/${b.id}`} className="font-semibold text-slate-900 hover:underline">
                            {b.car.name}
                          </Link>
                          {b.conflictOverride && (
                            <div className="mt-1">
                              <ConflictBadge />
                            </div>
                          )}
                        </td>
                        <td>
                          <Link href={`/bookings/${b.id}`} className="block">
                            <span className="font-medium text-slate-800">{b.customerName}</span>
                            <span className="muted block">{b.customerPhone}</span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-slate-700">
                          {formatDateTime(b.startAt)}
                          <span className="block text-slate-400">→ {formatDateTime(b.endAt)}</span>
                        </td>
                        <td className="whitespace-nowrap text-slate-700">
                          {billing.kmDriven == null ? (
                            <span className="text-amber-700">Pending</span>
                          ) : (
                            <>
                              {formatKm(billing.kmDriven)}
                              {billing.overageKm ? (
                                <span className="block text-rose-600">+{formatKm(billing.overageKm)} over</span>
                              ) : (
                                <span className="block text-slate-400">within {formatKm(billing.freeKm)}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="font-semibold whitespace-nowrap tabular-nums text-slate-900">
                          {billing.total == null ? (
                            <span className="font-medium text-amber-700">Pending return</span>
                          ) : (
                            formatMoney(billing.total, settings.currency)
                          )}
                        </td>
                        <td>
                          <StatusBadge status={b.status} short />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards on phones */}
          <ul className="space-y-3 sm:hidden">
            {bookings.map((b) => {
              const billing = computeBilling(b, settings);
              return (
                <li key={b.id} className="card card-pad">
                  <Link href={`/bookings/${b.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{b.car.name}</p>
                      <StatusBadge status={b.status} short />
                    </div>
                    <p className="muted mt-0.5">
                      {b.customerName} · {b.customerPhone}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatDateTime(b.startAt)}
                      <span className="block text-slate-400">→ {formatDateTime(b.endAt)}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {billing.kmDriven == null ? "Km pending" : formatKm(billing.kmDriven)}
                        {billing.overageKm ? <span className="text-rose-600"> (+{billing.overageKm} over)</span> : null}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {billing.total == null ? (
                          <span className="text-sm font-medium text-amber-700">Pending return</span>
                        ) : (
                          formatMoney(billing.total, settings.currency)
                        )}
                      </span>
                    </div>
                    {b.conflictOverride && (
                      <div className="mt-2">
                        <ConflictBadge />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
