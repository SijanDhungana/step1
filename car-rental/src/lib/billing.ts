/**
 * Km-overage billing. This module is the single source of truth for the maths —
 * every page, API route and test goes through `computeBilling`.
 *
 * Rules (values come from AppSettings, not from literals here):
 *   rental days   = ceil(duration / 24h), minimum 1  (1 day 3 hours -> 2 days)
 *   free km       = rental days x settings.freeKmPerDay
 *   km driven     = endKm - startKm
 *   overage km    = max(0, km driven - free km)
 *   overage $     = overage km x settings.overageRatePerKm
 *   base charge   = priceOverride ?? (dailyRate x rental days)
 *   total         = base charge + overage $
 */
import type { AppSettings } from "./config";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BillingInput = {
  startAt: Date | string;
  endAt: Date | string;
  startKm: number;
  endKm?: number | null;
  dailyRate: number;
  priceOverride?: number | null;
};

export type Billing = {
  /** Rental days, partial days rounded up, never less than 1. */
  rentalDays: number;
  /** Free kilometres included across the whole rental. */
  freeKm: number;
  /** Null until the car is returned (ending km entered). */
  kmDriven: number | null;
  overageKm: number | null;
  overageCharge: number | null;
  /** Rate x days, or the flat override when one is set. */
  baseCharge: number;
  /** True when the base charge came from a flat negotiated price. */
  usesOverride: boolean;
  /** Null while pending return — we never guess a total. */
  total: number | null;
  /** True when ending km has not been entered yet. */
  pendingReturn: boolean;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Round money to cents; avoids 0.1 + 0.2 style drift in displayed totals. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Number of chargeable rental days between two instants.
 * Any partial day counts as a full day, and a rental is always at least 1 day.
 */
export function rentalDays(startAt: Date | string, endAt: Date | string): number {
  const start = toDate(startAt).getTime();
  const end = toDate(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  const ms = end - start;
  if (ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

export function computeBilling(input: BillingInput, settings: AppSettings): Billing {
  const days = rentalDays(input.startAt, input.endAt);
  const freeKm = days * settings.freeKmPerDay;

  const usesOverride = input.priceOverride != null;
  const baseCharge = round2(usesOverride ? Number(input.priceOverride) : input.dailyRate * days);

  const hasReturn = input.endKm != null && Number.isFinite(Number(input.endKm));
  if (!hasReturn) {
    return {
      rentalDays: days,
      freeKm,
      kmDriven: null,
      overageKm: null,
      overageCharge: null,
      baseCharge,
      usesOverride,
      total: null,
      pendingReturn: true,
    };
  }

  const kmDriven = Number(input.endKm) - input.startKm;
  const overageKm = Math.max(0, kmDriven - freeKm);
  const overageCharge = round2(overageKm * settings.overageRatePerKm);

  return {
    rentalDays: days,
    freeKm,
    kmDriven,
    overageKm,
    overageCharge,
    baseCharge,
    usesOverride,
    total: round2(baseCharge + overageCharge),
    pendingReturn: false,
  };
}

/** Half-open overlap test: a rental ending exactly when the next starts is fine. */
export function overlaps(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return toDate(aStart) < toDate(bEnd) && toDate(bStart) < toDate(aEnd);
}
