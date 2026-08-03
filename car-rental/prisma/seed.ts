/**
 * Seeds the fixed 6-car fleet, the default admin account and the business-rule
 * settings row. Safe to re-run: everything is an upsert.
 *
 *   npm run seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/lib/config";

const prisma = new PrismaClient();

const FLEET = [
  { slug: "urus-yellow", name: "Yellow Lamborghini Urus", make: "Lamborghini", model: "Urus", color: "Yellow" },
  { slug: "urus-black", name: "Black Lamborghini Urus", make: "Lamborghini", model: "Urus", color: "Black" },
  { slug: "cls-53-amg", name: "Mercedes CLS 53 AMG", make: "Mercedes-Benz", model: "CLS 53 AMG", color: "Silver" },
  { slug: "bmw-330i", name: "BMW 330i M Sport", make: "BMW", model: "330i M Sport", color: "White" },
  { slug: "bmw-m340i", name: "BMW M340i", make: "BMW", model: "M340i", color: "Blue" },
  { slug: "hyundai-elantra", name: "Hyundai Elantra", make: "Hyundai", model: "Elantra", color: "Grey" },
];

async function main() {
  for (const [index, car] of FLEET.entries()) {
    await prisma.car.upsert({
      where: { slug: car.slug },
      create: { ...car, sort: index },
      update: { ...car, sort: index },
    });
  }
  console.log(`Fleet ready: ${FLEET.length} cars.`);

  await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...DEFAULT_SETTINGS },
    update: {}, // never clobber values the office has already tuned
  });
  console.log(
    `Settings ready: ${DEFAULT_SETTINGS.freeKmPerDay} free km/day, ` +
      `$${DEFAULT_SETTINGS.overageRatePerKm.toFixed(2)}/km overage.`,
  );

  const email = (process.env.ADMIN_EMAIL ?? "admin@rentals.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const name = process.env.ADMIN_NAME ?? "Fleet Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email} (password left unchanged).`);
  } else {
    await prisma.user.create({
      data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Admin account created: ${email} / ${password}  <-- change this after first login`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
