/**
 * Display helpers. Dates render in the server's timezone (set TZ in .env to pin it),
 * so the same string is produced on the server and in the browser for one office.
 */

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatKm(km: number): string {
  return `${new Intl.NumberFormat("en-US").format(km)} km`;
}

export function formatDateTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function formatShortDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

/** Date -> value for an <input type="datetime-local">, in local time. */
export function toDateTimeLocal(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date -> value for an <input type="date">, in local time. */
export function toDateInput(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "in 3 days" / "2 hours ago" — used for at-a-glance dashboard copy. */
export function relativeTime(value: Date | string, now: Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const minutes = Math.round(diffMs / 60000);
  if (abs < 60 * 60 * 1000) return rtf.format(minutes, "minute");
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  return rtf.format(Math.round(diffMs / 86_400_000), "day");
}
