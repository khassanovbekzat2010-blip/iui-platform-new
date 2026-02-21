import { DeviceStatus, SchoolInfo, TeacherProfile } from "@/lib/types";

export const schoolInfo: SchoolInfo = {
  name: "IUI Smart Academy",
  city: "San Francisco, CA",
  timezone: "PST (UTC-8)",
  academicYear: "2025-2026"
};

export const teacherProfile: TeacherProfile = {
  fullName: "Sophia Bennett",
  email: "s.bennett@iui.edu",
  subject: "Science & AI"
};

export const connectedDevices: DeviceStatus[] = [
  { id: "dv-1", name: "NeuroBand X12", type: "EEG", connected: true, lastSync: "2 min ago" },
  { id: "dv-2", name: "ESP32 Gateway", type: "ESP32", connected: true, lastSync: "1 min ago" },
  { id: "dv-3", name: "Attention Sensor Pod", type: "Sensor", connected: false, lastSync: "43 min ago" }
];
