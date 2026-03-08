import { describe, expect, it } from "vitest";

import {
  applyLevelProgress,
  calculateReward,
  isSuspiciousAttempt,
  rollLoot,
  xpNeeded
} from "./progression";

describe("journey progression", () => {
  it("calculates xp thresholds", () => {
    expect(xpNeeded(1)).toBe(100);
    expect(xpNeeded(2)).toBe(125);
  });

  it("levels up with carry over xp", () => {
    const result = applyLevelProgress(1, 95, 40);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(35);
  });

  it("applies suspicious penalty", () => {
    const normal = calculateReward({ baseXp: 20, baseCoins: 10, streak: 2, suspicious: false });
    const suspicious = calculateReward({ baseXp: 20, baseCoins: 10, streak: 2, suspicious: true });
    expect(suspicious.xp).toBeLessThan(normal.xp);
    expect(suspicious.coins).toBeLessThan(normal.coins);
  });

  it("detects suspicious fast attempts", () => {
    expect(isSuspiciousAttempt(900)).toBe(true);
    expect(isSuspiciousAttempt(3000)).toBe(false);
  });

  it("returns deterministic loot rarity", () => {
    const rarity = rollLoot(87);
    expect(["common", "rare", "epic"]).toContain(rarity);
  });
});
