import { NextResponse } from "next/server";
import { startSession, verifyPassword } from "@/lib/auth";
import type { Role } from "@/lib/config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message either way — don't reveal which staff emails exist.
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role });
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}
