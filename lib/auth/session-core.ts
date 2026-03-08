export type SessionRole = "teacher" | "student" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: SessionRole;
  studentId?: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: SessionRole;
  studentId?: string;
  exp: number;
  v: 1;
};

export const SESSION_COOKIE_NAME = "iui_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters long.");
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64Url(bytes);
}

function base64UrlToString(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return atob(normalized + pad);
}

async function sign(input: string) {
  const secret = getSessionSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(user: SessionUser, ttlSeconds = SESSION_TTL_SECONDS) {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email.toLowerCase(),
    name: user.name,
    role: user.role,
    studentId: user.studentId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    v: 1
  };
  const encoded = stringToBase64Url(JSON.stringify(payload));
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, givenSignature] = parts;
  const expectedSignature = await sign(encoded);
  if (!timingSafeEqual(givenSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlToString(encoded)) as SessionPayload;
    if (parsed.v !== 1 || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!parsed.sub || !parsed.email || !parsed.name || !parsed.role) return null;
    return {
      id: parsed.sub,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      studentId: parsed.studentId
    };
  } catch {
    return null;
  }
}

function readCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const items = cookieHeader.split(";").map((item) => item.trim());
  for (const item of items) {
    if (item.startsWith(`${name}=`)) {
      return decodeURIComponent(item.slice(name.length + 1));
    }
  }
  return null;
}

export async function getSessionUserFromRequest(request: Request) {
  const raw = readCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return verifySessionToken(raw);
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

