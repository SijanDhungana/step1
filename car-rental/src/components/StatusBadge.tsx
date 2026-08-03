import { STATUS_LABELS, STATUS_STYLES, type BookingStatus } from "@/lib/config";

export default function StatusBadge({ status, short = false }: { status: BookingStatus | string; short?: boolean }) {
  const key = (status in STATUS_STYLES ? status : "RESERVED") as BookingStatus;
  const label = short && key === "ACTIVE" ? "Active" : STATUS_LABELS[key];
  return (
    <span className={`badge ${STATUS_STYLES[key].badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[key].dot}`} />
      {label}
    </span>
  );
}

export function ConflictBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`badge bg-amber-100 text-amber-900 ring-amber-600/30 ${className}`}
      title="Saved despite an overlapping booking for this car"
    >
      ⚠ Double-booked
    </span>
  );
}
