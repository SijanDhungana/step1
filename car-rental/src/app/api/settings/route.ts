import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { fieldErrors, settingsSchema } from "@/lib/validation";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(request: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can change the rate settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  return NextResponse.json({ settings: await updateSettings(parsed.data) });
}
