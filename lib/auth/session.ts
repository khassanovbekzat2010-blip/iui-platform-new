import { cookies } from "next/headers";

export * from "@/lib/auth/session-core";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session-core";

export async function getSessionUserFromServerCookies() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;
  return verifySessionToken(token);
}

