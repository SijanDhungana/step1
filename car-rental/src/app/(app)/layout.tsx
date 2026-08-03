import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

/** Every page in this group is staff-only — signed-out visitors go to /login. */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
