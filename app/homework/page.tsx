"use client";

import { HomeworkSubmissionStatus } from "@prisma/client";
import { BookCheck, Camera, Clock3, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { SUBJECTS } from "@/lib/learning-config";
import { useAppStore } from "@/store/app-store";

type StudentHomeworkItem = {
  id: string;
  studentId?: string | null;
  generatedByAI?: boolean;
  difficulty?: string | null;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  description: string;
  dueDate: string;
  points: number;
  submission: {
    id?: string;
    status: HomeworkSubmissionStatus;
    textAnswer?: string;
    feedback?: string;
    photoDataUrl?: string | null;
    aiScore?: number | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    aiReviewedAt?: string | null;
  };
};

type TeacherHomeworkItem = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  description: string;
  dueDate: string;
  points: number;
  submissions: Array<{
    id: string;
    userId: string;
    studentName: string;
    studentEmail: string;
    status: HomeworkSubmissionStatus;
    textAnswer: string | null;
    photoDataUrl: string | null;
    feedback: string | null;
    aiScore: number | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    aiReviewedAt: string | null;
  }>;
};

const tabs: Array<"NOT_STARTED" | "SUBMITTED"> = ["NOT_STARTED", "SUBMITTED"];

function statusLabel(status: HomeworkSubmissionStatus | "NOT_STARTED" | "SUBMITTED") {
  switch (status) {
    case "NOT_STARTED":
      return "Не начато";
    case HomeworkSubmissionStatus.SUBMITTED:
      return "Отправлено";
    case HomeworkSubmissionStatus.ACCEPTED:
      return "Принято";
    case HomeworkSubmissionStatus.NEEDS_REVISION:
      return "Нужно доработать";
    case HomeworkSubmissionStatus.UNDER_REVIEW:
      return "Проверяется";
    default:
      return "Отправлено";
  }
}

export default function HomeworkPage() {
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const userId = getJourneyUserId(user);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [tab, setTab] = useState<"NOT_STARTED" | "SUBMITTED">("NOT_STARTED");
  const [studentHomework, setStudentHomework] = useState<StudentHomeworkItem[]>([]);
  const [teacherHomework, setTeacherHomework] = useState<TeacherHomeworkItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photoDataByHomework, setPhotoDataByHomework] = useState<Record<string, string>>({});
  const [photoNoteByHomework, setPhotoNoteByHomework] = useState<Record<string, string>>({});
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [newHomework, setNewHomework] = useState<{
    title: string;
    subject: string;
    grade: number;
    topic: string;
    description: string;
    dueDate: string;
    points: number;
  }>({
    title: "",
    subject: SUBJECTS[0],
    grade: 9,
    topic: "",
    description: "",
    dueDate: "",
    points: 10
  });

  const loadHomework = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const data = await apiRequest<{ role: "teacher" | "student"; homework: StudentHomeworkItem[] | TeacherHomeworkItem[] }>(
        `/api/homework?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(user?.role ?? "student")}`
      );
      setRole(data.role);
      if (data.role === "teacher") {
        setTeacherHomework(data.homework as TeacherHomeworkItem[]);
      } else {
        setStudentHomework(data.homework as StudentHomeworkItem[]);
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Не удалось загрузить домашние задания");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !userId) return;
    loadHomework();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, userId]);

  const filteredStudentHomework = useMemo(() => {
    return studentHomework.filter((item) => {
      const status = item.submission?.status ?? HomeworkSubmissionStatus.NOT_STARTED;
      if (tab === "NOT_STARTED") {
        return status === HomeworkSubmissionStatus.NOT_STARTED;
      }
      return status !== HomeworkSubmissionStatus.NOT_STARTED;
    });
  }, [studentHomework, tab]);

  const summary = useMemo(() => {
    const submitted = studentHomework.filter((item) => (item.submission?.status ?? HomeworkSubmissionStatus.NOT_STARTED) !== HomeworkSubmissionStatus.NOT_STARTED).length;
    const accepted = studentHomework.filter((item) => item.submission?.status === HomeworkSubmissionStatus.ACCEPTED).length;
    return {
      total: studentHomework.length,
      submitted,
      accepted
    };
  }, [studentHomework]);

  const submitHomework = async (homeworkId: string) => {
    const textAnswer = (answers[homeworkId] ?? "").trim();
    if (!textAnswer) {
      pushToast("Проверка", "Сначала напиши ответ.");
      return;
    }
    try {
      await apiRequest("/api/homework/submit", {
        method: "POST",
        body: JSON.stringify({ userId, homeworkId, textAnswer })
      });
      pushToast("Ответ отправлен", "AI уже проверил текстовый ответ и обновил результат.");
      loadHomework();
    } catch (error) {
      pushToast("Ошибка", error instanceof Error ? error.message : "Не удалось отправить ответ");
    }
  };

  const convertFileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      reader.readAsDataURL(file);
    });

  const handlePhotoSelected = async (homeworkId: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await convertFileToDataUrl(file);
      setPhotoDataByHomework((prev) => ({ ...prev, [homeworkId]: dataUrl }));
      pushToast("Фото добавлено", "Теперь можно отправить фото на AI-проверку.");
    } catch (error) {
      pushToast("Ошибка изображения", error instanceof Error ? error.message : "Не удалось загрузить изображение");
    }
  };

  const runAiPhotoCheck = async (homeworkId: string) => {
    const imageDataUrl = photoDataByHomework[homeworkId];
    if (!imageDataUrl) {
      pushToast("Нет фото", "Сначала прикрепи фото решения.");
      return;
    }

    try {
      await apiRequest("/api/homework/ai-review-photo", {
        method: "POST",
        body: JSON.stringify({
          homeworkId,
          imageDataUrl,
          note: photoNoteByHomework[homeworkId] ?? ""
        })
      });
      pushToast("Фото проверено", "AI обновил статус и feedback.");
      loadHomework();
    } catch (error) {
      pushToast("Ошибка AI", error instanceof Error ? error.message : "Не удалось проверить фото");
    }
  };

  const createHomework = async () => {
    if (!newHomework.title || !newHomework.topic || !newHomework.description || !newHomework.dueDate) {
      pushToast("Проверка", "Заполни все поля формы.");
      return;
    }
    try {
      await apiRequest("/api/homework", {
        method: "POST",
        body: JSON.stringify({ userId, role: user?.role, ...newHomework })
      });
      pushToast("Домашка создана", "Задание опубликовано для учеников.");
      setNewHomework({
        title: "",
        subject: SUBJECTS[0],
        grade: 9,
        topic: "",
        description: "",
        dueDate: "",
        points: 10
      });
      loadHomework();
    } catch (error) {
      pushToast("Ошибка", error instanceof Error ? error.message : "Не удалось создать домашку");
    }
  };

  const reviewSubmission = async (submissionId: string, status: "ACCEPTED" | "NEEDS_REVISION") => {
    try {
      await apiRequest("/api/homework/review", {
        method: "POST",
        body: JSON.stringify({
          reviewerId: userId,
          role: user?.role,
          submissionId,
          status,
          feedback: feedbackDraft[submissionId] ?? ""
        })
      });
      pushToast("Проверка сохранена", "Статус ответа обновлен.");
      loadHomework();
    } catch (error) {
      pushToast("Ошибка", error instanceof Error ? error.message : "Не удалось сохранить проверку");
    }
  };

  if (!hydrated || !user) return null;

  if (loading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (errorText) {
    return (
      <section className="space-y-4">
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Домашние задания</h2>
        <p className="text-sm text-muted-foreground">{errorText}</p>
        <Button variant="outline" onClick={loadHomework}>
          Повторить загрузку
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Домашние задания</h2>
        <p className="text-muted-foreground">
          После урока здесь появляются персональные задания. Хороший ответ дает XP, coins и укрепляет streak.
        </p>
      </div>

      {role === "student" ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <BookCheck className="h-5 w-5 text-sky-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Всего заданий</p>
                  <p className="text-2xl font-semibold">{summary.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <Clock3 className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Уже отправлено</p>
                  <p className="text-2xl font-semibold">{summary.submitted}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <Trophy className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Принято AI/учителем</p>
                  <p className="text-2xl font-semibold">{summary.accepted}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Фильтр</CardTitle>
              <CardDescription>Оставлены только два понятных состояния: новые задания и уже отправленные ответы.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {tabs.map((item) => (
                <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
                  {item === "NOT_STARTED" ? "Не начато" : "Отправлено"}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredStudentHomework.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">В этой категории пока нет заданий.</CardContent>
              </Card>
            ) : null}
            {filteredStudentHomework.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,0.95))]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>
                        {item.subject} • {item.topic} • {new Date(item.dueDate).toLocaleDateString("ru-RU")}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{statusLabel(item.submission?.status ?? HomeworkSubmissionStatus.NOT_STARTED)}</Badge>
                      {item.generatedByAI ? <Badge variant="success">AI-подбор</Badge> : null}
                      {item.difficulty ? <Badge variant="outline">{item.difficulty}</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-sm font-medium">Что нужно сделать</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-3 text-xs text-muted-foreground">Награда за качественный ответ: {item.points} XP + coins героя.</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Твой ответ</p>
                    <Textarea
                      placeholder="Напиши решение, объясни шаги или дай краткий вывод по теме."
                      value={answers[item.id] ?? item.submission?.textAnswer ?? ""}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    />
                    <Button onClick={() => submitHomework(item.id)}>Отправить текстовый ответ</Button>
                  </div>

                  <div className="rounded-2xl border border-dashed border-border/60 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Camera className="h-4 w-4" />
                      Фото решения
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Если решал в тетради, прикрепи фото и отправь на AI-проверку.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-border/60 px-3 py-2 text-sm">
                        Выбрать фото
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handlePhotoSelected(item.id, event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <Button variant="outline" onClick={() => runAiPhotoCheck(item.id)}>
                        Проверить фото через AI
                      </Button>
                    </div>
                    <Textarea
                      className="mt-3"
                      placeholder="Коротко напиши, что именно решил и в чем сомневаешься."
                      value={photoNoteByHomework[item.id] ?? ""}
                      onChange={(event) => setPhotoNoteByHomework((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    />
                    {(photoDataByHomework[item.id] ?? item.submission?.photoDataUrl) ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                        <img
                          src={photoDataByHomework[item.id] ?? item.submission?.photoDataUrl ?? ""}
                          alt={`Решение для ${item.title}`}
                          className="max-h-80 w-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>

                  {typeof item.submission?.aiScore === "number" ? (
                    <div className="rounded-2xl border border-border/60 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-sky-600" />
                        Результат проверки
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Оценка AI: {item.submission.aiScore}/100</p>
                      {item.submission.feedback ? <p className="mt-2 text-sm">{item.submission.feedback}</p> : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Создать домашнее задание</CardTitle>
              <CardDescription>Форма для ручной публикации задания от учителя.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Название задания" value={newHomework.title} onChange={(event) => setNewHomework((prev) => ({ ...prev, title: event.target.value }))} />
              <label className="block text-sm">
                Предмет
                <select className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm" value={newHomework.subject} onChange={(event) => setNewHomework((prev) => ({ ...prev, subject: event.target.value }))}>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <Input type="number" min={1} max={11} value={newHomework.grade} onChange={(event) => setNewHomework((prev) => ({ ...prev, grade: Number(event.target.value) || 1 }))} />
              <Input placeholder="Тема урока" value={newHomework.topic} onChange={(event) => setNewHomework((prev) => ({ ...prev, topic: event.target.value }))} />
              <Textarea placeholder="Формулировка задания" value={newHomework.description} onChange={(event) => setNewHomework((prev) => ({ ...prev, description: event.target.value }))} />
              <Input type="datetime-local" value={newHomework.dueDate} onChange={(event) => setNewHomework((prev) => ({ ...prev, dueDate: event.target.value }))} />
              <Input type="number" min={1} value={newHomework.points} onChange={(event) => setNewHomework((prev) => ({ ...prev, points: Number(event.target.value) || 1 }))} />
              <Button onClick={createHomework}>Опубликовать</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ответы учеников</CardTitle>
              <CardDescription>Проверка ответов, комментарии и финальное решение учителя.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teacherHomework.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет опубликованных домашних заданий.</p> : null}
              {teacherHomework.map((item) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-border/60 p-4">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.subject} • {item.topic} • дедлайн {new Date(item.dueDate).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  {item.submissions.length === 0 ? <p className="text-sm text-muted-foreground">Ученики еще не отправили ответы.</p> : null}
                  {item.submissions.map((submission) => (
                    <div key={submission.id} className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{submission.studentName}</p>
                          <p className="text-xs text-muted-foreground">{submission.studentEmail}</p>
                        </div>
                        <Badge variant="outline">{statusLabel(submission.status)}</Badge>
                      </div>
                      {typeof submission.aiScore === "number" ? <p className="text-xs text-muted-foreground">AI score: {submission.aiScore}/100</p> : null}
                      <p className="text-sm text-muted-foreground">{submission.textAnswer ?? "Текстовый ответ не добавлен"}</p>
                      {submission.photoDataUrl ? (
                        <div className="overflow-hidden rounded-xl border border-border/60">
                          <img src={submission.photoDataUrl} alt={`Решение ученика ${submission.studentName}`} className="max-h-72 w-full object-cover" />
                        </div>
                      ) : null}
                      <Textarea
                        placeholder="Комментарий ученику"
                        value={feedbackDraft[submission.id] ?? submission.feedback ?? ""}
                        onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, [submission.id]: event.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => reviewSubmission(submission.id, "ACCEPTED")}>
                          Принять
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reviewSubmission(submission.id, "NEEDS_REVISION")}>
                          Вернуть на доработку
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
