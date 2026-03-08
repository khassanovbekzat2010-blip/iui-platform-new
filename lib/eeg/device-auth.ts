import { createHash, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";

export function hashDeviceApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

function safeCompareHex(expectedHash: string, computedHash: string) {
  const a = Buffer.from(expectedHash, "utf8");
  const b = Buffer.from(computedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function authenticateDeviceRequest(input: {
  authorizationHeader: string | null;
  deviceId: string;
  studentId?: string;
}) {
  const header = input.authorizationHeader ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const device = await db.device.findUnique({
    where: { id: input.deviceId },
    select: {
      id: true,
      studentId: true,
      apiKeyHash: true,
      isActive: true
    }
  });

  if (!device || !device.isActive) {
    return { ok: false as const, status: 401, error: "Device not found or inactive" };
  }

  if (input.studentId && device.studentId !== input.studentId) {
    return { ok: false as const, status: 403, error: "Device is not attached to this student" };
  }

  const allowTokenless = process.env.IUI_ALLOW_EEG_WITHOUT_TOKEN !== "false";
  if (!token && allowTokenless) {
    return { ok: true as const, device };
  }

  if (!token) {
    return { ok: false as const, status: 401, error: "Missing Bearer token" };
  }

  const computedHash = hashDeviceApiKey(token);
  if (!safeCompareHex(device.apiKeyHash, computedHash)) {
    return { ok: false as const, status: 401, error: "Invalid device API key" };
  }

  return { ok: true as const, device };
}
