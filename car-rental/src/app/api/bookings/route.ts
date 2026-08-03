import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { computeBilling } from "@/lib/billing";
import { findConflicts } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bookingSchema, fieldErrors } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const carId = searchParams.get("carId");
  const status = searchParams.get("status");

  const bookings = await prisma.booking.findMany({
    where: {
      ...(carId ? { carId } : {}),
      ...(status ? { status } : {}),
    },
    include: { car: true },
    orderBy: { startAt: "desc" },
    take: 500,
  });

  const settings = await getSettings();
  return NextResponse.json({
    bookings: bookings.map((b) => ({ ...b, billing: computeBilling(b, settings) })),
  });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

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

  // A cancelled booking never blocks anything, so only check real ones.
  if (data.status !== "CANCELLED") {
    const conflicts = await findConflicts({ carId: data.carId, startAt, endAt });
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

  const conflictOverride =
    data.status !== "CANCELLED" &&
    data.allowConflict &&
    (await findConflicts({ carId: data.carId, startAt, endAt })).length > 0;

  const booking = await prisma.booking.create({
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
      conflictOverride,
      createdById: user.id,
    },
    include: { car: true },
  });

  const settings = await getSettings();
  return NextResponse.json({ booking: { ...booking, billing: computeBilling(booking, settings) } }, { status: 201 });
}
