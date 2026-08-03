import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const cars = await prisma.car.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  return NextResponse.json({ cars });
}
