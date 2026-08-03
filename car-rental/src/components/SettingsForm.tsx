"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppSettings } from "@/lib/config";

export default function SettingsForm({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const [freeKmPerDay, setFreeKmPerDay] = useState(String(settings.freeKmPerDay));
  const [overageRatePerKm, setOverageRatePerKm] = useState(String(settings.overageRatePerKm));
  const [defaultDailyRate, setDefaultDailyRate] = useState(String(settings.defaultDailyRate));
  const [currency, setCurrency] = useState(settings.currency);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setFields({});
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeKmPerDay: Number(freeKmPerDay),
          overageRatePerKm: Number(overageRatePerKm),
          defaultDailyRate: Number(defaultDailyRate),
          currency: currency.trim().toUpperCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFields(data.fields ?? {});
        setError(data.error ?? "Could not save the settings.");
        setBusy(false);
        return;
      }
      setMessage("Saved. New bookings and every breakdown now use these values.");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error — nothing was saved.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="freeKmPerDay">
            Free km included per rental day
          </label>
          <input
            id="freeKmPerDay"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className="input"
            value={freeKmPerDay}
            onChange={(e) => setFreeKmPerDay(e.target.value)}
            disabled={!canEdit}
            required
          />
          {fields.freeKmPerDay && <p className="field-error">{fields.freeKmPerDay}</p>}
        </div>

        <div>
          <label className="label" htmlFor="overageRatePerKm">
            Charge per km over the allowance
          </label>
          <input
            id="overageRatePerKm"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="input"
            value={overageRatePerKm}
            onChange={(e) => setOverageRatePerKm(e.target.value)}
            disabled={!canEdit}
            required
          />
          {fields.overageRatePerKm && <p className="field-error">{fields.overageRatePerKm}</p>}
        </div>

        <div>
          <label className="label" htmlFor="defaultDailyRate">
            Default daily rate on new bookings
          </label>
          <input
            id="defaultDailyRate"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="input"
            value={defaultDailyRate}
            onChange={(e) => setDefaultDailyRate(e.target.value)}
            disabled={!canEdit}
            required
          />
          {fields.defaultDailyRate && <p className="field-error">{fields.defaultDailyRate}</p>}
        </div>

        <div>
          <label className="label" htmlFor="currency">
            Currency code
          </label>
          <input
            id="currency"
            className="input uppercase"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!canEdit}
            required
          />
          {fields.currency && <p className="field-error">{fields.currency}</p>}
        </div>
      </div>

      <p className="muted">
        Changing these updates every breakdown in the app, including bookings already saved — the charge is always
        derived, never stored.
      </p>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{message}</p>}

      {canEdit ? (
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      ) : (
        <p className="muted">Only an admin can change these values.</p>
      )}
    </form>
  );
}
