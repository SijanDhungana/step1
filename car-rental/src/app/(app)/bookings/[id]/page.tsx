import Link from "next/link";
import { notFound } from "next/navigation";
import BillingBreakdown from "@/components/BillingBreakdown";
import BookingActions from "@/components/BookingActions";
import type { BookingFormValues } from "@/components/BookingForm";
import StatusBadge, { ConflictBadge } from "@/components/StatusBadge";
import { computeBilling } from "@/lib/billing";
import { findConflicts } from "@/lib/bookings";
import type { BookingStatus } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDateTime, formatKm, formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function BookingDetailPage({ params }: Params) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { car: true, createdBy: { select: { name: true } } },
  });
  if (!booking) notFound();

  const settings = await getSettings();
  const billing = computeBilling(booking, settings);
  const conflicts =
    booking.status === "CANCELLED"
      ? []
      : await findConflicts({
          carId: booking.carId,
          startAt: booking.startAt,
          endAt: booking.endAt,
          excludeBookingId: booking.id,
        });

  const values: BookingFormValues & { id: string } = {
    id: booking.id,
    carId: booking.carId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    startKm: booking.startKm,
    endKm: booking.endKm,
    dailyRate: booking.dailyRate,
    priceOverride: booking.priceOverride,
    notes: booking.notes ?? "",
    status: booking.status as BookingStatus,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/bookings" className="muted hover:underline">
          ← Back to bookings
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{booking.car.name}</h1>
            <p className="muted">
              {booking.customerName} · {booking.customerPhone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {booking.conflictOverride && <ConflictBadge />}
            <StatusBadge status={booking.status} />
            <Link href={`/bookings/${booking.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            ⚠ This car is double-booked for part of this period
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {conflicts.map((c) => (
              <li key={c.id}>
                <Link href={`/bookings/${c.id}`} className="font-medium underline underline-offset-2">
                  {c.customerName}
                </Link>{" "}
                — {formatDateTime(c.startAt)} → {formatDateTime(c.endAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card">
            <h2 className="section-title border-b border-slate-200 px-4 py-3 sm:px-5">Rental details</h2>
            <dl className="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2 sm:px-5">
              <Detail label="Picked up" value={formatDateTime(booking.startAt)} />
              <Detail label="Due back" value={formatDateTime(booking.endAt)} />
              <Detail label="Starting km" value={formatKm(booking.startKm)} />
              <Detail
                label="Ending km"
                value={booking.endKm == null ? "Pending return" : formatKm(booking.endKm)}
                pending={booking.endKm == null}
              />
              <Detail label="Daily rate" value={`${formatMoney(booking.dailyRate, settings.currency)} / day`} />
              <Detail
                label="Base price"
                value={
                  booking.priceOverride != null
                    ? `${formatMoney(booking.priceOverride, settings.currency)} (flat)`
                    : `${formatMoney(billing.baseCharge, settings.currency)} (${billing.rentalDays} × rate)`
                }
              />
            </dl>
            {booking.notes && (
              <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                <p className="label">Notes</p>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{booking.notes}</p>
              </div>
            )}
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
              <p className="muted">
                Created {formatDateTime(booking.createdAt)}
                {booking.createdBy ? ` by ${booking.createdBy.name}` : ""} · Last updated{" "}
                {formatDateTime(booking.updatedAt)}
              </p>
            </div>
          </section>

          <BillingBreakdown billing={billing} settings={settings} />
        </div>

        <div className="space-y-5">
          <BookingActions booking={values} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 sm:last:border-b">
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${pending ? "text-amber-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
