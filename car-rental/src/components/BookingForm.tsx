"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeBilling } from "@/lib/billing";
import { BOOKING_STATUSES, STATUS_LABELS, type AppSettings, type BookingStatus } from "@/lib/config";
import { formatDateTime, formatKm, formatMoney, toDateTimeLocal } from "@/lib/format";

export type CarOption = { id: string; name: string };

export type BookingFormValues = {
  id?: string;
  carId: string;
  customerName: string;
  customerPhone: string;
  startAt: string; // ISO
  endAt: string; // ISO
  startKm: number;
  endKm: number | null;
  dailyRate: number;
  priceOverride: number | null;
  notes: string;
  status: BookingStatus;
};

type Conflict = { id: string; customerName: string; status: string; startAt: string; endAt: string };

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toDateTimeLocal(d);
}

function defaultEnd(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  d.setDate(d.getDate() + 1);
  return toDateTimeLocal(d);
}

export default function BookingForm({
  cars,
  settings,
  booking,
}: {
  cars: CarOption[];
  settings: AppSettings;
  booking?: BookingFormValues;
}) {
  const router = useRouter();
  const editing = Boolean(booking?.id);

  const [carId, setCarId] = useState(booking?.carId ?? cars[0]?.id ?? "");
  const [customerName, setCustomerName] = useState(booking?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(booking?.customerPhone ?? "");
  const [startAt, setStartAt] = useState(booking ? toDateTimeLocal(booking.startAt) : defaultStart());
  const [endAt, setEndAt] = useState(booking ? toDateTimeLocal(booking.endAt) : defaultEnd());
  const [startKm, setStartKm] = useState(booking ? String(booking.startKm) : "");
  const [endKm, setEndKm] = useState(booking?.endKm != null ? String(booking.endKm) : "");
  const [dailyRate, setDailyRate] = useState(String(booking?.dailyRate ?? settings.defaultDailyRate));
  const [useFlatPrice, setUseFlatPrice] = useState(booking?.priceOverride != null);
  const [priceOverride, setPriceOverride] = useState(booking?.priceOverride != null ? String(booking.priceOverride) : "");
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? "RESERVED");

  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [checking, setChecking] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const money = (n: number) => formatMoney(n, settings.currency);
  const datesValid = useMemo(() => {
    const s = new Date(startAt).getTime();
    const e = new Date(endAt).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && e > s;
  }, [startAt, endAt]);

  // Live preview of the km-overage maths, using exactly the same function as the server.
  const preview = useMemo(() => {
    if (!datesValid) return null;
    const sk = num(startKm);
    if (sk == null) return null;
    // An ending reading below the starting one is invalid — keep the km side
    // pending rather than previewing negative distance.
    const ek = num(endKm);
    return computeBilling(
      {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        startKm: sk,
        endKm: ek != null && ek >= sk ? ek : null,
        dailyRate: num(dailyRate) ?? 0,
        priceOverride: useFlatPrice ? num(priceOverride) : null,
      },
      settings,
    );
  }, [datesValid, startAt, endAt, startKm, endKm, dailyRate, useFlatPrice, priceOverride, settings]);

  const kmError =
    num(endKm) != null && num(startKm) != null && (num(endKm) as number) < (num(startKm) as number)
      ? "Ending km must be greater than or equal to starting km."
      : null;

  // Availability check, debounced, whenever the car or dates change.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!carId || !datesValid || status === "CANCELLED") {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setChecking(true);
      try {
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            carId,
            startAt: new Date(startAt).toISOString(),
            endAt: new Date(endAt).toISOString(),
            excludeBookingId: booking?.id,
          }),
        });
        const data = await res.json().catch(() => ({}));
        setConflicts(res.ok ? (data.conflicts ?? []) : []);
      } catch {
        /* aborted or offline — leave the last known result */
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [carId, startAt, endAt, datesValid, status, booking?.id]);

  // A fresh conflict result invalidates any earlier "book anyway" confirmation.
  useEffect(() => {
    setPendingConfirm(false);
  }, [carId, startAt, endAt]);

  async function save(allowConflict: boolean) {
    setBusy(true);
    setFormError(null);
    setFields({});

    const payload = {
      carId,
      customerName,
      customerPhone,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      startKm: num(startKm) ?? Number.NaN,
      endKm: num(endKm),
      dailyRate: num(dailyRate) ?? Number.NaN,
      priceOverride: useFlatPrice ? num(priceOverride) : null,
      notes: notes.trim() === "" ? null : notes,
      status,
      allowConflict,
    };

    try {
      const res = await fetch(editing ? `/api/bookings/${booking!.id}` : "/api/bookings", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setConflicts(data.conflicts ?? []);
        setPendingConfirm(true);
        setFormError(data.error ?? "That car is already booked for those dates.");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        setFields(data.fields ?? {});
        setFormError(data.error ?? "Could not save the booking.");
        setBusy(false);
        return;
      }

      router.push(`/bookings/${data.booking.id}`);
      router.refresh();
    } catch {
      setFormError("Network error — the booking was not saved.");
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (kmError) {
      setFields({ endKm: kmError });
      setFormError("Please fix the highlighted fields.");
      return;
    }
    void save(pendingConfirm);
  }

  const err = (name: string) => fields[name];

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card card-pad space-y-4">
          <h2 className="section-title">Rental</h2>

          <div>
            <label className="label" htmlFor="carId">
              Car
            </label>
            <select id="carId" className="select" value={carId} onChange={(e) => setCarId(e.target.value)}>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name}
                </option>
              ))}
            </select>
            {err("carId") && <p className="field-error">{err("carId")}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startAt">
                Start date &amp; time
              </label>
              <input
                id="startAt"
                type="datetime-local"
                className="input"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
              {err("startAt") && <p className="field-error">{err("startAt")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="endAt">
                End date &amp; time
              </label>
              <input
                id="endAt"
                type="datetime-local"
                className="input"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
              {(err("endAt") || (!datesValid && endAt)) && (
                <p className="field-error">{err("endAt") ?? "End must be after the start."}</p>
              )}
            </div>
          </div>

          <AvailabilityNotice checking={checking} conflicts={conflicts} status={status} datesValid={datesValid} />
        </section>

        <section className="card card-pad space-y-4">
          <h2 className="section-title">Customer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customerName">
                Name
              </label>
              <input
                id="customerName"
                className="input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
              {err("customerName") && <p className="field-error">{err("customerName")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="customerPhone">
                Phone
              </label>
              <input
                id="customerPhone"
                type="tel"
                inputMode="tel"
                className="input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
              />
              {err("customerPhone") && <p className="field-error">{err("customerPhone")}</p>}
            </div>
          </div>
        </section>

        <section className="card card-pad space-y-4">
          <h2 className="section-title">Odometer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startKm">
                Starting km (at pickup)
              </label>
              <input
                id="startKm"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="input"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                required
              />
              {err("startKm") && <p className="field-error">{err("startKm")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="endKm">
                Ending km (at return)
              </label>
              <input
                id="endKm"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="input"
                placeholder="Leave blank until returned"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
              />
              {(err("endKm") || kmError) && <p className="field-error">{err("endKm") ?? kmError}</p>}
            </div>
          </div>
        </section>

        <section className="card card-pad space-y-4">
          <h2 className="section-title">Price &amp; status</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dailyRate">
                Daily rate ({settings.currency})
              </label>
              <input
                id="dailyRate"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="input"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                required
              />
              {err("dailyRate") && <p className="field-error">{err("dailyRate")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {err("status") && <p className="field-error">{err("status")}</p>}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={useFlatPrice}
                onChange={(e) => setUseFlatPrice(e.target.checked)}
              />
              Use a flat agreed price instead of rate × days
            </label>
            {useFlatPrice && (
              <div className="mt-3">
                <label className="label" htmlFor="priceOverride">
                  Flat base price ({settings.currency})
                </label>
                <input
                  id="priceOverride"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="input"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  required
                />
                <p className="muted mt-1">Km overage is still charged on top of this price.</p>
                {err("priceOverride") && <p className="field-error">{err("priceOverride")}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Deposit taken, damage noted at pickup, extra driver…"
            />
            {err("notes") && <p className="field-error">{err("notes")}</p>}
          </div>
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <PreviewCard preview={preview} settings={settings} money={money} />

        {formError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {formError}
          </p>
        )}

        {pendingConfirm && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Save anyway?</p>
            <p className="mt-1">
              This double-books the car. The booking will be tagged{" "}
              <span className="font-semibold">Double-booked</span> everywhere it appears.
            </p>
            <button
              type="button"
              className="btn-danger mt-3 w-full"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {busy ? "Saving…" : "Yes, double-book it"}
            </button>
            <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setPendingConfirm(false)}>
              No, change the dates
            </button>
          </div>
        )}

        {!pendingConfirm && (
          <div className="flex flex-col gap-2">
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create booking"}
            </button>
            <Link href={editing ? `/bookings/${booking!.id}` : "/bookings"} className="btn-secondary w-full">
              Cancel
            </Link>
          </div>
        )}
      </div>
    </form>
  );
}

function AvailabilityNotice({
  checking,
  conflicts,
  status,
  datesValid,
}: {
  checking: boolean;
  conflicts: Conflict[];
  status: BookingStatus;
  datesValid: boolean;
}) {
  if (status === "CANCELLED") {
    return <p className="muted">Cancelled bookings do not hold the car, so no availability check is needed.</p>;
  }
  if (!datesValid) return null;
  if (checking) return <p className="muted">Checking availability…</p>;

  if (conflicts.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        ✓ This car is free for the selected period.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">
        ⚠ Already booked — {conflicts.length} overlapping booking{conflicts.length === 1 ? "" : "s"}
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
      <p className="mt-2 text-xs text-amber-800">
        Saving will ask you to confirm before double-booking this car.
      </p>
    </div>
  );
}

function PreviewCard({
  preview,
  settings,
  money,
}: {
  preview: ReturnType<typeof computeBilling> | null;
  settings: AppSettings;
  money: (n: number) => string;
}) {
  return (
    <div className="card card-pad">
      <h2 className="section-title mb-3">Charge preview</h2>
      {!preview ? (
        <p className="muted">Fill in the dates and starting km to see the breakdown.</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          <Line label="Rental days" value={`${preview.rentalDays}`} />
          <Line label={`Free km (${settings.freeKmPerDay}/day)`} value={formatKm(preview.freeKm)} />
          <Line
            label="Km driven"
            value={preview.kmDriven == null ? "Pending return" : formatKm(preview.kmDriven)}
            pending={preview.kmDriven == null}
          />
          <Line
            label="Overage km"
            value={preview.overageKm == null ? "Pending return" : formatKm(preview.overageKm)}
            pending={preview.overageKm == null}
          />
          <Line
            label={`Overage @ ${money(settings.overageRatePerKm)}/km`}
            value={preview.overageCharge == null ? "Pending return" : money(preview.overageCharge)}
            pending={preview.overageCharge == null}
          />
          <Line label="Base price" value={money(preview.baseCharge)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-900">Total</dt>
            <dd className={`text-lg font-bold tabular-nums ${preview.total == null ? "text-amber-700" : "text-slate-900"}`}>
              {preview.total == null ? "Pending return" : money(preview.total)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Line({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`tabular-nums ${pending ? "text-amber-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
