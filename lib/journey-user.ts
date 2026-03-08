import { AuthUser } from "@/lib/types";

export function getJourneyUserId(user: AuthUser | null) {
  if (!user) return "";
  if (user.id) return user.id;
  if (user.email.toLowerCase() === "teacher@test.com") return "teacher-1";
  if (user.studentId) return user.studentId;
  return user.email.toLowerCase();
}
