import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm, { type BookingFormValues } from "@/components/BookingForm";
import type { BookingStatus } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit booking — Fleet Rentals" };

type Params = { params: Promise<{ id: string }> };

export default async function EditBookingPage({ params }: Params) {
  const { id } = await params;
  const [booking, cars, settings] = await Promise.all([
    prisma.booking.findUnique({ where: { id }, include: { car: true } }),
    prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    getSettings(),
  ]);
  if (!booking) notFound();

  const values: BookingFormValues = {
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
        <Link href={`/bookings/${booking.id}`} className="muted hover:underline">
          ← Back to booking
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Edit booking</h1>
        <p className="muted">
          {booking.car.name} · {booking.customerName}
        </p>
      </div>

      <BookingForm cars={cars.map((c) => ({ id: c.id, name: c.name }))} settings={settings} booking={values} />
    </div>
  );
}
