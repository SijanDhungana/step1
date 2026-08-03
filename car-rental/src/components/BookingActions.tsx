"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingFormValues } from "./BookingForm";
import { BOOKING_STATUSES, STATUS_LABELS, type BookingStatus } from "@/lib/config";

/**
 * Quick actions on a saved booking: move it through its statuses, record the
 * return odometer, or delete it. Everything goes through the same PATCH/DELETE
 * endpoints the edit form uses, so validation stays in one place.
 */
export default function BookingActions({ booking }: { booking: BookingFormValues & { id: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [endKm, setEndKm] = useState(booking.endKm != null ? String(booking.endKm) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(changes: Partial<BookingFormValues>) {
    setBusy(true);
    setError(null);
    const payload = {
      carId: booking.carId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      startAt: booking.startAt,
      endAt: booking.endAt,
      startKm: booking.startKm,
      endKm: booking.endKm,
      dailyRate: booking.dailyRate,
      priceOverride: booking.priceOverride,
      notes: booking.notes,
      status: booking.status,
      // The booking already exists; a status change must not be blocked by its own
      // (already acknowledged) overlap.
      allowConflict: true,
      ...changes,
    };
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.fields?.endKm ?? data.error ?? "Could not update the booking.");
        setBusy(false);
        return;
      }
      setReturning(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error — nothing was changed.");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete the booking.");
        setBusy(false);
        return;
      }
      router.push("/bookings");
      router.refresh();
    } catch {
      setError("Network error — the booking was not deleted.");
      setBusy(false);
    }
  }

  function recordReturn(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(endKm);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      setError("Enter the ending odometer reading as a whole number.");
      return;
    }
    if (value < booking.startKm) {
      setError(`Ending km must be at least the starting km (${booking.startKm.toLocaleString()}).`);
      return;
    }
    void patch({ endKm: value, status: "RETURNED" });
  }

  const nextStatuses = BOOKING_STATUSES.filter((s) => s !== booking.status);

  return (
    <div className="card card-pad space-y-4">
      <h2 className="section-title">Actions</h2>

      {booking.status !== "RETURNED" && (
        <div>
          {returning ? (
            <form onSubmit={recordReturn} className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div>
                <label className="label" htmlFor="returnKm">
                  Ending km at return
                </label>
                <input
                  id="returnKm"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={booking.startKm}
                  className="input"
                  value={endKm}
                  onChange={(e) => setEndKm(e.target.value)}
                  autoFocus
                  required
                />
                <p className="muted mt-1">Picked up at {booking.startKm.toLocaleString()} km.</p>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1" disabled={busy}>
                  {busy ? "Saving…" : "Record return"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setReturning(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={() => setReturning(true)} disabled={busy}>
              Record return &amp; ending km
            </button>
          )}
        </div>
      )}

      <div>
        <p className="label">Change status</p>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void patch({ status: s as BookingStatus })}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <p className="muted mt-1">Marking a rental returned requires the ending km.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="border-t border-slate-200 pt-4">
        {confirmDelete ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-semibold text-rose-800">Delete this booking permanently?</p>
            <p className="mt-1 text-sm text-rose-700">
              This cannot be undone. To keep the record instead, set the status to Cancelled.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-danger flex-1" onClick={() => void remove()} disabled={busy}>
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost w-full text-rose-600" onClick={() => setConfirmDelete(true)}>
            Delete booking
          </button>
        )}
      </div>
    </div>
  );
}
