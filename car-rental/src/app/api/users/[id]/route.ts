import { NextResponse } from "next/server";
import { apiUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fieldErrors, userUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  // Don't let the last admin demote themselves out of the system.
  if (parsed.data.role === "STAFF" && target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "This is the only admin — promote someone else first." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot delete the account you are signed in with." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "This is the only admin account — it cannot be removed." }, { status: 400 });
    }
  }

  // Bookings survive; they simply lose their "created by" link.
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
