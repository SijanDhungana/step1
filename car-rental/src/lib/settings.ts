import "server-only";
import { DEFAULT_SETTINGS, type AppSettings } from "./config";
import { prisma } from "./db";

/**
 * Reads the tunable business rules (free km/day, $/km, default rate, currency).
 * Creates the single settings row from DEFAULT_SETTINGS the first time it is missing,
 * so a fresh database never falls back to scattered literals.
 */
export async function getSettings(): Promise<AppSettings> {
  const existing = await prisma.setting.findUnique({ where: { id: 1 } });
  if (existing) {
    return {
      freeKmPerDay: existing.freeKmPerDay,
      overageRatePerKm: existing.overageRatePerKm,
      defaultDailyRate: existing.defaultDailyRate,
      currency: existing.currency,
    };
  }
  const created = await prisma.setting.create({ data: { id: 1, ...DEFAULT_SETTINGS } });
  return {
    freeKmPerDay: created.freeKmPerDay,
    overageRatePerKm: created.overageRatePerKm,
    defaultDailyRate: created.defaultDailyRate,
    currency: created.currency,
  };
}

export async function updateSettings(input: AppSettings): Promise<AppSettings> {
  const saved = await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...input },
    update: input,
  });
  return {
    freeKmPerDay: saved.freeKmPerDay,
    overageRatePerKm: saved.overageRatePerKm,
    defaultDailyRate: saved.defaultDailyRate,
    currency: saved.currency,
  };
}
