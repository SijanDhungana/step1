import type { Billing } from "@/lib/billing";
import type { AppSettings } from "@/lib/config";
import { formatKm, formatMoney } from "@/lib/format";

function Row({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "font-semibold text-slate-900" : ""}`}>
      <span className={strong ? "" : "text-slate-600"}>
        {label}
        {hint && <span className="ml-1 text-xs text-slate-400">{hint}</span>}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The rental's money breakdown. Before the car is returned we show the allowance
 * and base charge but explicitly mark the km side as pending — never a guessed total.
 */
export default function BillingBreakdown({ billing, settings }: { billing: Billing; settings: AppSettings }) {
  const money = (n: number) => formatMoney(n, settings.currency);

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="section-title">Charges</h2>
        {billing.pendingReturn ? (
          <span className="badge bg-amber-100 text-amber-900 ring-amber-600/30">Pending return</span>
        ) : (
          <span className="badge bg-emerald-100 text-emerald-800 ring-emerald-600/20">Final</span>
        )}
      </div>

      <div className="divide-y divide-slate-100 px-4 text-sm sm:px-5">
        <Row label="Rental days" value={`${billing.rentalDays} ${billing.rentalDays === 1 ? "day" : "days"}`} hint="partial days round up" />
        <Row
          label="Free km allowed"
          value={formatKm(billing.freeKm)}
          hint={`${billing.rentalDays} × ${settings.freeKmPerDay}/day`}
        />
        <Row label="Km driven" value={billing.kmDriven == null ? <span className="text-amber-700">Pending return</span> : formatKm(billing.kmDriven)} />
        <Row
          label="Overage km"
          value={billing.overageKm == null ? <span className="text-amber-700">Pending return</span> : formatKm(billing.overageKm)}
        />
        <Row
          label="Overage charge"
          value={
            billing.overageCharge == null ? (
              <span className="text-amber-700">Pending return</span>
            ) : (
              money(billing.overageCharge)
            )
          }
          hint={`@ ${money(settings.overageRatePerKm)}/km`}
        />
        <Row
          label="Base rental price"
          value={money(billing.baseCharge)}
          hint={billing.usesOverride ? "flat agreed price" : `rate × ${billing.rentalDays}`}
        />
      </div>

      <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-base font-semibold text-slate-900">Total charge</span>
          {billing.total == null ? (
            <span className="text-base font-semibold text-amber-700">Pending return</span>
          ) : (
            <span className="text-2xl font-bold tabular-nums text-slate-900">{money(billing.total)}</span>
          )}
        </div>
        {billing.pendingReturn && (
          <p className="muted mt-1">Enter the ending km when the car comes back to finalise this rental.</p>
        )}
      </div>
    </div>
  );
}
