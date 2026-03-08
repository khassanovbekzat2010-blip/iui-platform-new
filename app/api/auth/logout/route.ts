import { NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...sessionCookieOptions(0),
    value: "",
    expires: new Date(0)
  });
  return response;
}

