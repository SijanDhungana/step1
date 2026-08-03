import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { fleetAvailability, findConflicts } from "@/lib/bookings";
import { availabilityQuerySchema, fieldErrors } from "@/lib/validation";

/**
 * Live availability check used by the booking form (single car) and the
 * availability page (whole fleet when carId is omitted).
 */
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = availabilityQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the dates.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);

  if (parsed.data.carId) {
    const conflicts = await findConflicts({
      carId: parsed.data.carId,
      startAt,
      endAt,
      excludeBookingId: parsed.data.excludeBookingId ?? null,
    });
    return NextResponse.json({
      available: conflicts.length === 0,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        customerName: c.customerName,
        status: c.status,
        startAt: c.startAt,
        endAt: c.endAt,
        car: c.car.name,
      })),
    });
  }

  const fleet = await fleetAvailability(startAt, endAt);
  return NextResponse.json({
    fleet: fleet.map((row) => ({
      car: { id: row.car.id, name: row.car.name },
      available: row.available,
      bookings: row.bookings.map((b) => ({
        id: b.id,
        customerName: b.customerName,
        status: b.status,
        startAt: b.startAt,
        endAt: b.endAt,
      })),
    })),
  });
}
