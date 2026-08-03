"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/config";

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

export default function UsersManager({ users, currentUserId }: { users: StaffRow[]; currentUserId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setFields({});
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFields(data.fields ?? {});
        setError(data.error ?? "Could not create the account.");
        setBusy(false);
        return;
      }
      setMessage(`${data.user.name} can now sign in.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error — the account was not created.");
      setBusy(false);
    }
  }

  async function act(id: string, method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update that account.");
        setBusy(false);
        return;
      }
      setResetFor(null);
      setNewPassword("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error — nothing was changed.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="section-title">Staff accounts</h2>
          <p className="muted">{users.length} account{users.length === 1 ? "" : "s"} with access to this console.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {u.name}
                    {u.id === currentUserId && <span className="muted ml-2">(you)</span>}
                  </p>
                  <p className="muted">{u.email}</p>
                </div>
                <span
                  className={`badge ${
                    u.role === "ADMIN"
                      ? "bg-slate-900 text-white ring-slate-900/20"
                      : "bg-slate-100 text-slate-700 ring-slate-500/20"
                  }`}
                >
                  {u.role === "ADMIN" ? "Admin" : "Staff"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => act(u.id, "PATCH", { role: u.role === "ADMIN" ? "STAFF" : "ADMIN" })}
                >
                  Make {u.role === "ADMIN" ? "staff" : "admin"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setResetFor(resetFor === u.id ? null : u.id);
                    setNewPassword("");
                  }}
                >
                  Reset password
                </button>
                {u.id !== currentUserId && (
                  <button type="button" className="btn-ghost text-rose-600" disabled={busy} onClick={() => act(u.id, "DELETE")}>
                    Remove
                  </button>
                )}
              </div>

              {resetFor === u.id && (
                <form
                  className="mt-3 flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(u.id, "PATCH", { password: newPassword });
                  }}
                >
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="New password (min 8 characters)"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={busy}>
                    Set password
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={addUser} className="card card-pad h-fit space-y-4">
        <h2 className="section-title">Add staff</h2>

        <div>
          <label className="label" htmlFor="newName">
            Name
          </label>
          <input id="newName" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          {fields.name && <p className="field-error">{fields.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="newEmail">
            Email
          </label>
          <input
            id="newEmail"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fields.email && <p className="field-error">{fields.email}</p>}
        </div>

        <div>
          <label className="label" htmlFor="newPasswordField">
            Temporary password
          </label>
          <input
            id="newPasswordField"
            type="text"
            className="input"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="muted mt-1">At least 8 characters. Share it with them to change later.</p>
          {fields.password && <p className="field-error">{fields.password}</p>}
        </div>

        <div>
          <label className="label" htmlFor="newRole">
            Role
          </label>
          <select id="newRole" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="STAFF">Staff — bookings only</option>
            <option value="ADMIN">Admin — bookings, rates and staff</option>
          </select>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{message}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
