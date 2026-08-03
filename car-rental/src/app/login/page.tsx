import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — Fleet Rentals" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white font-bold text-slate-900">
            FR
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fleet Rentals</h1>
          <p className="mt-1 text-sm text-slate-400">Staff console — sign in to continue</p>
        </div>

        <div className="card card-pad">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Internal system. Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
