import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "New booking — Fleet Rentals" };

export default async function NewBookingPage() {
  const [cars, settings] = await Promise.all([
    prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/bookings" className="muted hover:underline">
          ← Back to bookings
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">New booking</h1>
        <p className="muted">
          Includes {settings.freeKmPerDay} free km per rental day; extra km bill at{" "}
          {new Intl.NumberFormat("en-US", { style: "currency", currency: settings.currency }).format(
            settings.overageRatePerKm,
          )}{" "}
          each.
        </p>
      </div>

      <BookingForm cars={cars.map((c) => ({ id: c.id, name: c.name }))} settings={settings} />
    </div>
  );
}
