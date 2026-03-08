import { redirect } from "next/navigation";

import { LiveLessonWorkspace } from "@/components/lesson/live-lesson-workspace";
import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { getSessionUserFromServerCookies } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export default async function LiveLessonPage() {
  await ensureDatabaseReady();
  const user = await getSessionUserFromServerCookies();
  if (!user) {
    redirect("/login");
  }

  const archive = await db.lesson.findMany({
    where: isTeacherRole(user.role)
      ? { teacherId: user.id }
      : {
          participants: {
            some: { userId: user.id, accessGranted: true }
          }
        },
    select: {
      id: true,
      title: true,
      subject: true,
      classroomName: true,
      aiStatus: true,
      createdAt: true,
      summary: true,
      aiError: true,
      durationSec: true
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  let participants: Array<{ id: string; name: string; email: string; state: "online" | "active" | "offline" }> = [];
  if (isTeacherRole(user.role)) {
    const studentIds = await getTeacherStudentIds(user.id);
    if (studentIds.length) {
      const [students, devices] = await Promise.all([
        db.user.findMany({
          where: { id: { in: studentIds }, role: "student" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: 40
        }),
        db.device.findMany({
          where: { studentId: { in: studentIds }, isActive: true },
          select: { studentId: true, lastSeenAt: true },
          orderBy: { updatedAt: "desc" }
        })
      ]);

      const latestSeenByStudent = new Map<string, Date | null>();
      for (const device of devices) {
        if (!latestSeenByStudent.has(device.studentId)) {
          latestSeenByStudent.set(device.studentId, device.lastSeenAt);
        }
      }

      participants = students.map((student) => {
        const lastSeenAt = latestSeenByStudent.get(student.id);
        const ageMs = lastSeenAt ? Date.now() - lastSeenAt.getTime() : Number.POSITIVE_INFINITY;
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          state: ageMs <= 10_000 ? "active" : ageMs <= 60_000 ? "online" : "offline"
        };
      });
    }
  }

  return (
    <LiveLessonWorkspace
      user={user}
      archive={archive.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString()
      }))}
      participants={participants}
    />
  );
}
