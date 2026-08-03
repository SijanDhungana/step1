/**
 * Business rules for the rental company, in ONE place.
 *
 * These are the seed/fallback values. They are written into the `Setting` row on
 * first run and can then be changed at runtime from the Settings page — no code
 * change or redeploy needed. Nothing else in the codebase hardcodes these numbers.
 */
export const DEFAULT_SETTINGS = {
  /** Free kilometres included per rental day. */
  freeKmPerDay: 200,
  /** Charge per kilometre driven beyond the free allowance. */
  overageRatePerKm: 1.0,
  /** Pre-filled per-day rate when staff open a new booking form. */
  defaultDailyRate: 250,
  /** ISO currency code used for all money formatting. */
  currency: "USD",
} as const;

export type AppSettings = {
  freeKmPerDay: number;
  overageRatePerKm: number;
  defaultDailyRate: number;
  currency: string;
};

/** How long a staff session cookie stays valid. */
export const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 12);

export const SESSION_COOKIE = "car_rental_session";

export const BOOKING_STATUSES = ["RESERVED", "ACTIVE", "RETURNED", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that make a car unavailable. Cancelled bookings never block a date range. */
export const BLOCKING_STATUSES: BookingStatus[] = ["RESERVED", "ACTIVE", "RETURNED"];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  RESERVED: "Reserved",
  ACTIVE: "Active (out now)",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

/** Tailwind classes per status — used by badges, the calendar and the availability grid. */
export const STATUS_STYLES: Record<BookingStatus, { badge: string; bar: string; dot: string }> = {
  RESERVED: {
    badge: "bg-blue-100 text-blue-800 ring-blue-600/20",
    bar: "bg-blue-500 text-white",
    dot: "bg-blue-500",
  },
  ACTIVE: {
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
    bar: "bg-emerald-600 text-white",
    dot: "bg-emerald-600",
  },
  RETURNED: {
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    bar: "bg-slate-400 text-white",
    dot: "bg-slate-400",
  },
  CANCELLED: {
    badge: "bg-rose-100 text-rose-700 ring-rose-600/20",
    bar: "bg-rose-300 text-rose-900 line-through",
    dot: "bg-rose-400",
  },
};

export const ROLES = ["ADMIN", "STAFF"] as const;
export type Role = (typeof ROLES)[number];
