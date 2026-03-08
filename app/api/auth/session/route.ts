import { NextResponse } from "next/server";

import { getSessionUserFromRequest } from "@/lib/auth/session";

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

