import UsersManager from "@/components/UsersManager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff — Fleet Rentals" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff</h1>
        <p className="muted">There is no public signup — accounts are created here.</p>
      </div>

      <UsersManager
        currentUserId={admin.id}
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      />
    </div>
  );
}
