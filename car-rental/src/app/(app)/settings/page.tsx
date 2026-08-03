import SettingsForm from "@/components/SettingsForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Fleet Rentals" };

export default async function SettingsPage() {
  const [user, settings, cars] = await Promise.all([
    requireUser(),
    getSettings(),
    prisma.car.findMany({ orderBy: { sort: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="muted">Rental rules used everywhere in the app.</p>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Km allowance &amp; overage</h2>
        <p className="muted">
          Currently: {settings.freeKmPerDay} free km per rental day, then{" "}
          {formatMoney(settings.overageRatePerKm, settings.currency)} per extra km.
        </p>
        <SettingsForm settings={settings} canEdit={user.role === "ADMIN"} />
      </section>

      <section className="card">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="section-title">Fleet</h2>
          <p className="muted">The fixed {cars.length}-car fleet, seeded on first run.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {cars.map((car) => (
            <li key={car.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div>
                <p className="font-medium text-slate-900">{car.name}</p>
                <p className="muted">
                  {car.make} {car.model} · {car.color}
                  {car.plate ? ` · ${car.plate}` : ""}
                </p>
              </div>
              <span className={`badge ${car.active ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
                {car.active ? "In service" : "Retired"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
