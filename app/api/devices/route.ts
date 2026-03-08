import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";

import { getTeacherStudentIds, isTeacherRole, teacherOwnsStudent } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { hashDeviceApiKey } from "@/lib/eeg/device-auth";

const bindSchema = z.object({
  deviceId: z.string().min(2).max(120),
  studentId: z.string().min(2),
  deviceName: z.string().min(2).max(120),
  apiKey: z.string().min(8).max(256).optional()
});

const querySchema = z.object({
  studentId: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    let where:
      | { studentId: string }
      | { studentId: { in: string[] } }
      | undefined;

    if (session.user.role === "student") {
      where = { studentId: session.user.id };
    } else if (session.user.role === "teacher") {
      const teacherStudentIds = await getTeacherStudentIds(session.user.id);
      where = query.studentId
        ? { studentId: query.studentId }
        : { studentId: { in: teacherStudentIds } };
    } else if (query.studentId) {
      where = { studentId: query.studentId };
    }

    if (session.user.role === "teacher" && query.studentId) {
      const owns = await teacherOwnsStudent(session.user.id, query.studentId);
      if (!owns) {
        return NextResponse.json({ error: "You cannot access devices for this student" }, { status: 403 });
      }
    }

    const devices = await db.device.findMany({
      where: where ?? {},
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        studentId: true,
        deviceName: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      devices: devices.map((item) => ({
        ...item,
        lastSeenAt: item.lastSeenAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load devices" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    if (!isTeacherRole(session.user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can bind devices" }, { status: 403 });
    }

    const body = bindSchema.parse(await request.json());

    if (session.user.role === "teacher") {
      const owns = await teacherOwnsStudent(session.user.id, body.studentId);
      if (!owns) {
        return NextResponse.json({ error: "Student does not belong to your classroom" }, { status: 403 });
      }
    }

    const existingDevice = await db.device.findUnique({
      where: { id: body.deviceId },
      select: {
        id: true,
        apiKeyHash: true
      }
    });

    const generatedApiKey = !existingDevice && !body.apiKey ? randomBytes(24).toString("hex") : null;
    const plainApiKey = body.apiKey ?? generatedApiKey;
    const apiKeyHash = plainApiKey ? hashDeviceApiKey(plainApiKey) : existingDevice?.apiKeyHash;

    if (!apiKeyHash) {
      return NextResponse.json({ error: "Device API key could not be resolved" }, { status: 400 });
    }

    await db.device.upsert({
      where: { id: body.deviceId },
      create: {
        id: body.deviceId,
        studentId: body.studentId,
        deviceName: body.deviceName,
        apiKeyHash,
        isActive: true
      },
      update: {
        studentId: body.studentId,
        deviceName: body.deviceName,
        apiKeyHash,
        isActive: true
      }
    });

    return NextResponse.json({
      ok: true,
      device: {
        id: body.deviceId,
        studentId: body.studentId,
        deviceName: body.deviceName
      },
      generatedApiKey
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to bind device" },
      { status: 400 }
    );
  }
}
