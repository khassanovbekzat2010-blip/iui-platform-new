import { NextResponse } from "next/server";

import { SessionUser, getSessionUserFromRequest } from "@/lib/auth/session";

export async function requireSession(request: Request): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user };
}

