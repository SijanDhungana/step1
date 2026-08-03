import "server-only";
import type { Booking, Car } from "@prisma/client";
import { computeBilling, type Billing } from "./billing";
import { BLOCKING_STATUSES, type BookingStatus } from "./config";
import { prisma } from "./db";
import { getSettings } from "./settings";

export type BookingWithCar = Booking & { car: Car };

/**
 * Bookings for the same car whose date range overlaps [startAt, endAt).
 * Cancelled bookings never conflict; a booking can be excluded by id when editing.
 */
export async function findConflicts(params: {
  carId: string;
  startAt: Date;
  endAt: Date;
  excludeBookingId?: string | null;
}): Promise<BookingWithCar[]> {
  return prisma.booking.findMany({
    where: {
      carId: params.carId,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    include: { car: true },
    orderBy: { startAt: "asc" },
  });
}

/** Availability of every car over a date range, with whatever is taking it. */
export async function fleetAvailability(startAt: Date, endAt: Date) {
  const [cars, bookings] = await Promise.all([
    prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.booking.findMany({
      where: {
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      include: { car: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  return cars.map((car) => {
    const conflicts = bookings.filter((b) => b.carId === car.id);
    return { car, available: conflicts.length === 0, bookings: conflicts };
  });
}

/** Dashboard snapshot: what is out right now, what is free, and what happens today. */
export async function fleetSnapshot(now: Date = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [cars, current, todays] = await Promise.all([
    prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.booking.findMany({
      where: {
        status: { in: ["RESERVED", "ACTIVE"] },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      include: { car: true },
      orderBy: { endAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["RESERVED", "ACTIVE"] },
        OR: [
          { startAt: { gte: dayStart, lt: dayEnd } },
          { endAt: { gte: dayStart, lt: dayEnd } },
        ],
      },
      include: { car: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  // Booked today at any point (so "free today" means free for the whole day).
  const bookedToday = await prisma.booking.findMany({
    where: {
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { carId: true },
  });
  const bookedTodayIds = new Set(bookedToday.map((b) => b.carId));
  const outNowIds = new Set(current.map((b) => b.carId));

  const overdue = await prisma.booking.findMany({
    where: { status: "ACTIVE", endAt: { lt: now } },
    include: { car: true },
    orderBy: { endAt: "asc" },
  });

  return {
    cars,
    outNow: current,
    outNowIds,
    availableToday: cars.filter((c) => !bookedTodayIds.has(c.id)),
    pickupsToday: todays.filter((b) => b.startAt >= dayStart && b.startAt < dayEnd),
    returnsToday: todays.filter((b) => b.endAt >= dayStart && b.endAt < dayEnd),
    overdue,
  };
}

/** Booking plus its billing breakdown, ready to hand to the UI or return from the API. */
export async function withBilling(booking: BookingWithCar): Promise<BookingWithCar & { billing: Billing }> {
  const settings = await getSettings();
  return { ...booking, billing: computeBilling(booking, settings) };
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (["RESERVED", "ACTIVE", "RETURNED", "CANCELLED"] as string[]).includes(value);
}
