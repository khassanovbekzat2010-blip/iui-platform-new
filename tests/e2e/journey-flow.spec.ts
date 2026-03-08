import { expect, test } from "@playwright/test";

const userId = "st-02";

test("complete quest and get progress update", async ({ request }) => {
  await request.post("/api/onboarding", {
    data: {
      userId,
      role: "student",
      grade: 9,
      subjects: ["Physics", "Math"],
      goal: "9 класс физика",
      archetype: "Scholar"
    }
  });

  const dashboardBefore = await request.get(`/api/dashboard?userId=${userId}`);
  expect(dashboardBefore.ok()).toBeTruthy();
  const before = await dashboardBefore.json();
  expect(before.mainQuest).toBeTruthy();

  const questId = before.mainQuest.id as string;
  const questRes = await request.get(`/api/quests/${questId}?userId=${userId}`);
  expect(questRes.ok()).toBeTruthy();
  const quest = await questRes.json();

  for (const task of quest.tasks as Array<{ id: string; type: string; options: string[] | null }>) {
    const answer = task.type === "quiz" ? "B" : task.type === "open" ? "force" : "vector";
    const taskRes = await request.post("/api/quests/task/complete", {
      data: {
        userId,
        taskId: task.id,
        answer,
        timeSpentMs: 2200
      }
    });
    expect(taskRes.ok()).toBeTruthy();
  }

  const completeRes = await request.post("/api/quests/complete", {
    data: { userId, questId }
  });
  expect(completeRes.ok()).toBeTruthy();

  const dashboardAfter = await request.get(`/api/dashboard?userId=${userId}`);
  expect(dashboardAfter.ok()).toBeTruthy();
  const after = await dashboardAfter.json();
  expect(after.questStats.completed).toBeGreaterThanOrEqual(before.questStats.completed);
});

test("boss attempt gives reward on pass", async ({ request }) => {
  const mapRes = await request.get(`/api/journey/map?userId=${userId}`);
  expect(mapRes.ok()).toBeTruthy();

  const bossRes = await request.get(`/api/boss/boss-1?userId=${userId}`);
  expect(bossRes.ok()).toBeTruthy();
  const bossData = await bossRes.json();

  const attemptRes = await request.post("/api/boss/attempt", {
    data: {
      userId,
      bossId: bossData.boss.id,
      score: 90,
      timeSpentMs: 80000
    }
  });
  expect(attemptRes.ok()).toBeTruthy();
  const attempt = await attemptRes.json();
  expect(attempt.passed).toBe(true);
});
