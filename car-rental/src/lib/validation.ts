import { z } from "zod";
import { BOOKING_STATUSES, ROLES } from "./config";

const isoDate = z
  .string()
  .min(1, "Required")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Not a valid date/time");

const km = z
  .number({ error: "Enter a number" })
  .int("Must be a whole number")
  .min(0, "Cannot be negative")
  .max(10_000_000, "That odometer reading looks wrong");

const money = z.number({ error: "Enter an amount" }).min(0, "Cannot be negative").max(1_000_000, "Too large");

export const bookingSchema = z
  .object({
    carId: z.string().min(1, "Pick a car"),
    customerName: z.string().trim().min(1, "Customer name is required").max(120),
    customerPhone: z.string().trim().min(3, "Customer phone is required").max(40),
    startAt: isoDate,
    endAt: isoDate,
    startKm: km,
    endKm: km.nullable().optional(),
    dailyRate: money,
    priceOverride: money.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(BOOKING_STATUSES),
    /** Set by the UI when staff confirm they want to save over a conflicting booking. */
    allowConflict: z.boolean().optional().default(false),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: "End date/time must be after the start",
    path: ["endAt"],
  })
  .refine((v) => v.endKm == null || v.endKm >= v.startKm, {
    message: "Ending km must be greater than or equal to starting km",
    path: ["endKm"],
  })
  .refine((v) => v.status !== "RETURNED" || v.endKm != null, {
    message: "Enter the ending km before marking the rental returned",
    path: ["endKm"],
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required").email("Enter a valid email"),
  name: z.string().trim().min(1, "Name is required").max(120),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  role: z.enum(ROLES),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().min(8, "Use at least 8 characters").max(200).optional(),
});

export const settingsSchema = z.object({
  freeKmPerDay: z.number().int("Whole kilometres only").min(0, "Cannot be negative").max(100_000),
  overageRatePerKm: z.number().min(0, "Cannot be negative").max(10_000),
  defaultDailyRate: z.number().min(0, "Cannot be negative").max(1_000_000),
  currency: z.string().trim().length(3, "Use a 3-letter code such as USD").toUpperCase(),
});

export const availabilityQuerySchema = z
  .object({
    carId: z.string().optional(),
    startAt: isoDate,
    endAt: isoDate,
    excludeBookingId: z.string().optional(),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: "End date/time must be after the start",
    path: ["endAt"],
  });

/** Turns a ZodError into { field: message } for the forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
