import { db } from "@/lib/db";

let initialized = false;

export async function ensureDatabaseReady() {
  if (initialized) return;

  const connectionUrl = process.env.POSTGRES_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (connectionUrl.startsWith("postgresql://") || connectionUrl.startsWith("postgres://")) {
    initialized = true;
    return;
  }

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Profile" (
      "userId" TEXT PRIMARY KEY NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'student',
      "grade" INTEGER,
      "subjects" TEXT,
      "goal" TEXT,
      "language" TEXT DEFAULT 'ru',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Gamification" (
      "userId" TEXT PRIMARY KEY NOT NULL,
      "avatarId" TEXT NOT NULL DEFAULT 'avatar-01',
      "level" INTEGER NOT NULL DEFAULT 1,
      "xp" INTEGER NOT NULL DEFAULT 0,
      "streakDays" INTEGER NOT NULL DEFAULT 0,
      "lastActivityDate" DATETIME,
      "coins" INTEGER NOT NULL DEFAULT 0,
      "showCharacter" BOOLEAN NOT NULL DEFAULT true,
      "enableStreak" BOOLEAN NOT NULL DEFAULT true,
      FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyTask" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "subject" TEXT NOT NULL,
      "grade" INTEGER NOT NULL,
      "topic" TEXT NOT NULL,
      "difficulty" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "options" TEXT,
      "correctAnswer" TEXT NOT NULL,
      "explanation" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyCompletion" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "dailyTaskId" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "isCorrect" BOOLEAN NOT NULL,
      "answer" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("dailyTaskId") REFERENCES "DailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DailyCompletion_userId_date_idx" ON "DailyCompletion"("userId","date");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Homework" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "createdBy" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "grade" INTEGER NOT NULL,
      "topic" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "dueDate" DATETIME NOT NULL,
      "points" INTEGER NOT NULL DEFAULT 10,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_grade_subject_idx" ON "Homework"("grade","subject");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeworkSubmission" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "homeworkId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
      "textAnswer" TEXT,
      "feedback" TEXT,
      "submittedAt" DATETIME,
      "reviewedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_userId_key" ON "HomeworkSubmission"("homeworkId","userId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeworkSubmission_userId_status_idx" ON "HomeworkSubmission"("userId","status");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Settings" (
      "userId" TEXT PRIMARY KEY NOT NULL,
      "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
      "homeworkDeadlineReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
      FOREIGN KEY ("userId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'student',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudentProfile" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL UNIQUE,
      "grade" INTEGER NOT NULL,
      "subjects" TEXT NOT NULL,
      "goals" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StudentProfile_grade_idx" ON "StudentProfile"("grade");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Hero" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL UNIQUE,
      "archetype" TEXT NOT NULL,
      "level" INTEGER NOT NULL DEFAULT 1,
      "xp" INTEGER NOT NULL DEFAULT 0,
      "focus" INTEGER NOT NULL DEFAULT 10,
      "logic" INTEGER NOT NULL DEFAULT 10,
      "creativity" INTEGER NOT NULL DEFAULT 10,
      "discipline" INTEGER NOT NULL DEFAULT 10,
      "avatarUrl" TEXT NOT NULL,
      "coins" INTEGER NOT NULL DEFAULT 0,
      "gems" INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Hero_level_xp_idx" ON "Hero"("level","xp");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Act" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "orderIndex" INTEGER NOT NULL,
      "grade" INTEGER NOT NULL,
      "subject" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Act_grade_subject_orderIndex_key" ON "Act"("grade","subject","orderIndex");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Act_isActive_grade_subject_idx" ON "Act"("isActive","grade","subject");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "JourneyStep" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "actId" TEXT NOT NULL,
      "orderIndex" INTEGER NOT NULL,
      "code" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "rewardXp" INTEGER NOT NULL DEFAULT 0,
      "rewardCoins" INTEGER NOT NULL DEFAULT 0,
      "isBoss" BOOLEAN NOT NULL DEFAULT false,
      "isLockedByDefault" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("actId") REFERENCES "Act"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "JourneyStep_actId_orderIndex_key" ON "JourneyStep"("actId","orderIndex");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "JourneyStep_actId_isBoss_idx" ON "JourneyStep"("actId","isBoss");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Quest" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "stepId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "difficulty" TEXT NOT NULL,
      "isMain" BOOLEAN NOT NULL DEFAULT false,
      "baseXp" INTEGER NOT NULL DEFAULT 20,
      "baseCoins" INTEGER NOT NULL DEFAULT 10,
      "unlockOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("stepId") REFERENCES "JourneyStep"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Quest_stepId_unlockOrder_idx" ON "Quest"("stepId","unlockOrder");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Task" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "questId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "options" TEXT,
      "correctAnswer" TEXT NOT NULL,
      "explanation" TEXT NOT NULL,
      "topic" TEXT NOT NULL,
      "difficulty" TEXT NOT NULL,
      "orderIndex" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Task_questId_orderIndex_idx" ON "Task"("questId","orderIndex");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Attempt" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "taskId" TEXT NOT NULL,
      "questId" TEXT,
      "answer" TEXT NOT NULL,
      "isCorrect" BOOLEAN NOT NULL,
      "timeSpentMs" INTEGER NOT NULL,
      "suspicious" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attempt_userId_createdAt_idx" ON "Attempt"("userId","createdAt");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attempt_questId_userId_idx" ON "Attempt"("questId","userId");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuestProgress" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "questId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'LOCKED',
      "completedAt" DATETIME,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "QuestProgress_userId_questId_key" ON "QuestProgress"("userId","questId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuestProgress_userId_status_idx" ON "QuestProgress"("userId","status");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "JourneyStepProgress" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "stepId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'LOCKED',
      "unlockedAt" DATETIME,
      "completedAt" DATETIME,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("stepId") REFERENCES "JourneyStep"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "JourneyStepProgress_userId_stepId_key" ON "JourneyStepProgress"("userId","stepId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "JourneyStepProgress_userId_status_idx" ON "JourneyStepProgress"("userId","status");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BossBattle" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "stepId" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "timeLimitSec" INTEGER NOT NULL,
      "maxAttempts" INTEGER NOT NULL DEFAULT 3,
      "passScore" INTEGER NOT NULL,
      "rewardChest" TEXT NOT NULL DEFAULT 'common',
      FOREIGN KEY ("stepId") REFERENCES "JourneyStep"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BossAttempt" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "bossId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "score" INTEGER NOT NULL,
      "passed" BOOLEAN NOT NULL,
      "timeSpentMs" INTEGER NOT NULL,
      "attemptNo" INTEGER NOT NULL,
      "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("bossId") REFERENCES "BossBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BossAttempt_bossId_userId_createdAt_idx" ON "BossAttempt"("bossId","userId","createdAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ItemDefinition" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "rarity" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "priceCoins" INTEGER NOT NULL DEFAULT 0,
      "priceGems" INTEGER NOT NULL DEFAULT 0,
      "effects" TEXT,
      "cooldownSeconds" INTEGER,
      "isStreakFreeze" BOOLEAN NOT NULL DEFAULT false
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InventoryItem" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "itemDefinitionId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_userId_itemDefinitionId_key" ON "InventoryItem"("userId","itemDefinitionId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryItem_userId_idx" ON "InventoryItem"("userId");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RewardTransaction" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT,
      "xp" INTEGER NOT NULL DEFAULT 0,
      "coins" INTEGER NOT NULL DEFAULT 0,
      "gems" INTEGER NOT NULL DEFAULT 0,
      "itemDefinitionId" TEXT,
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RewardTransaction_userId_createdAt_idx" ON "RewardTransaction"("userId","createdAt");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RewardTransaction_sourceType_sourceId_idx" ON "RewardTransaction"("sourceType","sourceId");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AchievementDefinition" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "code" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "xpReward" INTEGER NOT NULL DEFAULT 0,
      "coinsReward" INTEGER NOT NULL DEFAULT 0,
      "gemsReward" INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserAchievement" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "achievementDefinitionId" TEXT NOT NULL,
      "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("achievementDefinitionId") REFERENCES "AchievementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementDefinitionId_key" ON "UserAchievement"("userId","achievementDefinitionId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId","unlockedAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Streak" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL UNIQUE,
      "current" INTEGER NOT NULL DEFAULT 0,
      "best" INTEGER NOT NULL DEFAULT 0,
      "lastActiveDate" DATETIME,
      "freezeCount" INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Classroom" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "grade" INTEGER NOT NULL,
      "teacherId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Classroom_teacherId_grade_idx" ON "Classroom"("teacherId","grade");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Enrollment" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "classroomId" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_classroomId_studentId_key" ON "Enrollment"("classroomId","studentId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Enrollment_studentId_idx" ON "Enrollment"("studentId");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailOtpCode" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "name" TEXT,
      "expiresAt" DATETIME NOT NULL,
      "consumed" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailOtpCode_email_consumed_expiresAt_idx" ON "EmailOtpCode"("email","consumed","expiresAt");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EmailOtpCode_email_createdAt_idx" ON "EmailOtpCode"("email","createdAt");`);

  const studentProfileColumns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("StudentProfile");`);
  if (!studentProfileColumns.some((column) => column.name === "isActive")) {
    await db.$executeRawUnsafe(`ALTER TABLE "StudentProfile" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;`);
  }

  const homeworkColumns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Homework");`);
  if (!homeworkColumns.some((column) => column.name === "lessonId")) {
    await db.$executeRawUnsafe(`ALTER TABLE "Homework" ADD COLUMN "lessonId" TEXT;`);
  }
  const homeworkSubmissionColumns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("HomeworkSubmission");`);
  if (!homeworkSubmissionColumns.some((column) => column.name === "photoDataUrl")) {
    await db.$executeRawUnsafe(`ALTER TABLE "HomeworkSubmission" ADD COLUMN "photoDataUrl" TEXT;`);
  }
  if (!homeworkSubmissionColumns.some((column) => column.name === "aiScore")) {
    await db.$executeRawUnsafe(`ALTER TABLE "HomeworkSubmission" ADD COLUMN "aiScore" INTEGER;`);
  }
  if (!homeworkSubmissionColumns.some((column) => column.name === "aiReviewedAt")) {
    await db.$executeRawUnsafe(`ALTER TABLE "HomeworkSubmission" ADD COLUMN "aiReviewedAt" DATETIME;`);
  }

  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_lessonId_idx" ON "Homework"("lessonId");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Lesson" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "teacherId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "classroomName" TEXT,
      "aiStatus" TEXT NOT NULL DEFAULT 'SAVED',
      "startedAt" DATETIME,
      "endedAt" DATETIME,
      "durationSec" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "transcript" TEXT,
      "summary" TEXT,
      "aiError" TEXT,
      "s3Bucket" TEXT,
      "s3Region" TEXT,
      "recordingKey" TEXT,
      "transcriptKey" TEXT,
      "summaryKey" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lesson_teacherId_createdAt_idx" ON "Lesson"("teacherId","createdAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LessonParticipant" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "lessonId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "state" TEXT NOT NULL DEFAULT 'ONLINE',
      "joinedAt" DATETIME,
      "leftAt" DATETIME,
      "accessGranted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LessonParticipant_lessonId_userId_key" ON "LessonParticipant"("lessonId","userId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LessonParticipant_userId_createdAt_idx" ON "LessonParticipant"("userId","createdAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LessonMaterial" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "lessonId" TEXT NOT NULL,
      "uploadedById" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "mimeType" TEXT,
      "sizeBytes" INTEGER,
      "storageBucket" TEXT,
      "storageKey" TEXT,
      "publicUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LessonMaterial_lessonId_createdAt_idx" ON "LessonMaterial"("lessonId","createdAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LessonHighlight" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "lessonId" TEXT NOT NULL,
      "authorId" TEXT NOT NULL,
      "labelTime" TEXT,
      "text" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LessonHighlight_lessonId_createdAt_idx" ON "LessonHighlight"("lessonId","createdAt");`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeviceTelemetry" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "studentId" TEXT NOT NULL,
      "deviceName" TEXT NOT NULL,
      "deviceType" TEXT NOT NULL,
      "connectionState" TEXT NOT NULL,
      "focus" INTEGER,
      "signal" INTEGER,
      "payload" TEXT,
      "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DeviceTelemetry_studentId_recordedAt_idx" ON "DeviceTelemetry"("studentId","recordedAt");`);

  initialized = true;
}
