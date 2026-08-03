import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { computeBilling } from "@/lib/billing";
import { findConflicts } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bookingSchema, fieldErrors } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { car: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const settings = await getSettings();
  return NextResponse.json({ booking: { ...booking, billing: computeBilling(booking, settings) } });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  const car = await prisma.car.findUnique({ where: { id: data.carId } });
  if (!car) return NextResponse.json({ error: "That car is not in the fleet." }, { status: 400 });

  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);

  let conflicting = 0;
  if (data.status !== "CANCELLED") {
    const conflicts = await findConflicts({ carId: data.carId, startAt, endAt, excludeBookingId: id });
    conflicting = conflicts.length;
    if (conflicts.length > 0 && !data.allowConflict) {
      return NextResponse.json(
        {
          error: `${car.name} is already booked for part of that period.`,
          conflicts: conflicts.map((c) => ({
            id: c.id,
            customerName: c.customerName,
            status: c.status,
            startAt: c.startAt,
            endAt: c.endAt,
          })),
        },
        { status: 409 },
      );
    }
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: {
      carId: data.carId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      startAt,
      endAt,
      startKm: data.startKm,
      endKm: data.endKm ?? null,
      dailyRate: data.dailyRate,
      priceOverride: data.priceOverride ?? null,
      notes: data.notes ?? null,
      status: data.status,
      conflictOverride: conflicting > 0,
    },
    include: { car: true },
  });

  const settings = await getSettings();
  return NextResponse.json({ booking: { ...booking, billing: computeBilling(booking, settings) } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
