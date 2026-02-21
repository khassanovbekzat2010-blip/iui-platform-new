import { EngagementSample } from "@/lib/types";

export function createNextEngagement(previous: number) {
  const shift = Math.floor(Math.random() * 15) - 7;
  const value = Math.max(50, Math.min(98, previous + shift));
  const dropped = value < 70;

  return { value, dropped };
}

export function createEngagementPoint(value: number, dropped: boolean): EngagementSample {
  const now = new Date();
  const label = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;

  return { label, value, dropped };
}
