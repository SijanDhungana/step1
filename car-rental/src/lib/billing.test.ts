import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeBilling, overlaps, rentalDays } from "./billing";
import { DEFAULT_SETTINGS, type AppSettings } from "./config";

const settings: AppSettings = { ...DEFAULT_SETTINGS };
const at = (iso: string) => new Date(iso);

test("rental days round any partial day up, minimum one", () => {
  assert.equal(rentalDays(at("2026-01-01T10:00:00Z"), at("2026-01-01T12:00:00Z")), 1, "2 hours = 1 day");
  assert.equal(rentalDays(at("2026-01-01T10:00:00Z"), at("2026-01-02T10:00:00Z")), 1, "exactly 24h = 1 day");
  assert.equal(rentalDays(at("2026-01-01T10:00:00Z"), at("2026-01-02T13:00:00Z")), 2, "1 day 3 hours = 2 days");
  assert.equal(rentalDays(at("2026-01-01T10:00:00Z"), at("2026-01-04T10:00:00Z")), 3, "exactly 72h = 3 days");
  assert.equal(rentalDays(at("2026-01-01T10:00:00Z"), at("2026-01-04T10:00:01Z")), 4, "one second over = 4 days");
  assert.equal(rentalDays(at("2026-01-05T10:00:00Z"), at("2026-01-01T10:00:00Z")), 1, "end before start floors to 1");
});

test("pending return: no km numbers until ending km is entered", () => {
  const b = computeBilling(
    { startAt: at("2026-01-01T10:00:00Z"), endAt: at("2026-01-03T10:00:00Z"), startKm: 10_000, endKm: null, dailyRate: 250 },
    settings,
  );
  assert.equal(b.pendingReturn, true);
  assert.equal(b.rentalDays, 2);
  assert.equal(b.freeKm, 400);
  assert.equal(b.kmDriven, null);
  assert.equal(b.overageCharge, null);
  assert.equal(b.total, null, "no total is guessed before return");
  assert.equal(b.baseCharge, 500);
});

test("within the free allowance costs nothing extra", () => {
  const b = computeBilling(
    { startAt: at("2026-01-01T10:00:00Z"), endAt: at("2026-01-03T10:00:00Z"), startKm: 10_000, endKm: 10_350, dailyRate: 250 },
    settings,
  );
  assert.equal(b.rentalDays, 2);
  assert.equal(b.freeKm, 400);
  assert.equal(b.kmDriven, 350);
  assert.equal(b.overageKm, 0);
  assert.equal(b.overageCharge, 0);
  assert.equal(b.total, 500);
});

test("overage is charged per km beyond the allowance", () => {
  // 1 day 3 hours -> 2 days -> 400 free km. Drove 750 -> 350 over -> $350.
  const b = computeBilling(
    { startAt: at("2026-01-01T10:00:00Z"), endAt: at("2026-01-02T13:00:00Z"), startKm: 20_000, endKm: 20_750, dailyRate: 300 },
    settings,
  );
  assert.equal(b.rentalDays, 2);
  assert.equal(b.freeKm, 400);
  assert.equal(b.kmDriven, 750);
  assert.equal(b.overageKm, 350);
  assert.equal(b.overageCharge, 350);
  assert.equal(b.baseCharge, 600);
  assert.equal(b.total, 950);
});

test("a flat price override replaces rate x days but not the overage", () => {
  const b = computeBilling(
    {
      startAt: at("2026-01-01T10:00:00Z"),
      endAt: at("2026-01-04T10:00:00Z"),
      startKm: 0,
      endKm: 900,
      dailyRate: 250,
      priceOverride: 700,
    },
    settings,
  );
  assert.equal(b.rentalDays, 3);
  assert.equal(b.freeKm, 600);
  assert.equal(b.overageKm, 300);
  assert.equal(b.usesOverride, true);
  assert.equal(b.baseCharge, 700, "override wins over 3 x 250");
  assert.equal(b.total, 1000);
});

test("settings drive the maths — changing them changes the bill", () => {
  const custom: AppSettings = { ...settings, freeKmPerDay: 100, overageRatePerKm: 2.5 };
  const b = computeBilling(
    { startAt: at("2026-01-01T10:00:00Z"), endAt: at("2026-01-02T10:00:00Z"), startKm: 500, endKm: 800, dailyRate: 200 },
    custom,
  );
  assert.equal(b.freeKm, 100);
  assert.equal(b.overageKm, 200);
  assert.equal(b.overageCharge, 500);
  assert.equal(b.total, 700);
});

test("money is rounded to cents", () => {
  const custom: AppSettings = { ...settings, overageRatePerKm: 0.1 };
  const b = computeBilling(
    { startAt: at("2026-01-01T10:00:00Z"), endAt: at("2026-01-02T10:00:00Z"), startKm: 0, endKm: 203, dailyRate: 99.99 },
    custom,
  );
  assert.equal(b.overageKm, 3);
  assert.equal(b.overageCharge, 0.3);
  assert.equal(b.total, 100.29);
});

test("overlap is half-open: back-to-back bookings do not collide", () => {
  const a = ["2026-02-01T10:00:00Z", "2026-02-03T10:00:00Z"] as const;
  assert.equal(overlaps(a[0], a[1], "2026-02-03T10:00:00Z", "2026-02-05T10:00:00Z"), false, "touching ends");
  assert.equal(overlaps(a[0], a[1], "2026-02-02T09:00:00Z", "2026-02-04T10:00:00Z"), true, "partial overlap");
  assert.equal(overlaps(a[0], a[1], "2026-02-01T12:00:00Z", "2026-02-02T12:00:00Z"), true, "fully inside");
  assert.equal(overlaps(a[0], a[1], "2026-01-01T10:00:00Z", "2026-03-01T10:00:00Z"), true, "fully around");
  assert.equal(overlaps(a[0], a[1], "2026-02-04T10:00:00Z", "2026-02-05T10:00:00Z"), false, "clear of it");
});
