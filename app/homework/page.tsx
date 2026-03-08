"use client";

import { HomeworkSubmissionStatus } from "@prisma/client";
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
      setErrorText(error instanceof Error ? error.message : "Failed to load homework");
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
      const status = item.submission?.status ?? "NOT_STARTED";
      if (tab === "NOT_STARTED") {
        return status === "NOT_STARTED";
      }
      return status !== "NOT_STARTED";
    });
  }, [studentHomework, tab]);

  const submitHomework = async (homeworkId: string) => {
    const textAnswer = (answers[homeworkId] ?? "").trim();
    if (!textAnswer) {
      pushToast("Validation", "Write your answer before submit");
      return;
    }
    try {
      await apiRequest("/api/homework/submit", {
        method: "POST",
        body: JSON.stringify({ userId, homeworkId, textAnswer })
      });
      pushToast("Submitted", "Homework status changed to SUBMITTED");
      loadHomework();
    } catch (error) {
      pushToast("Error", error instanceof Error ? error.message : "Submit failed");
    }
  };

  const convertFileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const handlePhotoSelected = async (homeworkId: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await convertFileToDataUrl(file);
      setPhotoDataByHomework((prev) => ({ ...prev, [homeworkId]: dataUrl }));
      pushToast("Photo attached", "Now run AI check for this homework.");
    } catch (error) {
      pushToast("Image error", error instanceof Error ? error.message : "Cannot read image");
    }
  };

  const runAiPhotoCheck = async (homeworkId: string) => {
    const imageDataUrl = photoDataByHomework[homeworkId];
    if (!imageDataUrl) {
      pushToast("No image", "Attach a photo first.");
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
      pushToast("AI checked photo", "Submission was reviewed automatically.");
      loadHomework();
    } catch (error) {
      pushToast("AI check failed", error instanceof Error ? error.message : "Request failed");
    }
  };

  const createHomework = async () => {
    if (!newHomework.title || !newHomework.topic || !newHomework.description || !newHomework.dueDate) {
      pushToast("Validation", "Fill all form fields");
      return;
    }
    try {
      await apiRequest("/api/homework", {
        method: "POST",
        body: JSON.stringify({ userId, role: user?.role, ...newHomework })
      });
      pushToast("Created", "Homework assignment created");
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
      pushToast("Error", error instanceof Error ? error.message : "Create failed");
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
      pushToast("Saved", "Review status was updated");
      loadHomework();
    } catch (error) {
      pushToast("Error", error instanceof Error ? error.message : "Review failed");
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
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Homework</h2>
        <p className="text-sm text-muted-foreground">{errorText}</p>
        <Button variant="outline" onClick={loadHomework}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Homework</h2>
        <p className="text-muted-foreground">Assignments, submissions, reviews and AI-generated tasks from live lessons.</p>
      </div>

      {role === "student" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Status filter</CardTitle>
              <CardDescription>Track your progress through all homework states.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {tabs.map((item) => (
                <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredStudentHomework.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">No homework in selected status.</CardContent>
              </Card>
            ) : null}
            {filteredStudentHomework.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>
                    {item.subject} • Grade {item.grade} • Due {new Date(item.dueDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.generatedByAI ? <Badge variant="success">AI homework</Badge> : null}
                    {item.difficulty ? <Badge variant="outline">Difficulty: {item.difficulty}</Badge> : null}
                  </div>
                  <Badge variant="outline">{item.submission?.status ?? "NOT_STARTED"}</Badge>
                  {typeof item.submission?.aiScore === "number" ? (
                    <p className="text-xs text-muted-foreground">AI score: {item.submission.aiScore}/100</p>
                  ) : null}
                  <Textarea
                    placeholder="Write your homework answer..."
                    value={answers[item.id] ?? item.submission?.textAnswer ?? ""}
                    onChange={(event) => setAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => submitHomework(item.id)}>Submit text</Button>
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-border/60 px-3 py-2 text-sm">
                      Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handlePhotoSelected(item.id, event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <Button variant="outline" onClick={() => runAiPhotoCheck(item.id)}>
                      AI check photo
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Optional note for AI (what you solved, where unsure, etc.)"
                    value={photoNoteByHomework[item.id] ?? ""}
                    onChange={(event) => setPhotoNoteByHomework((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  />
                  {(photoDataByHomework[item.id] ?? item.submission?.photoDataUrl) ? (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      <img
                        src={photoDataByHomework[item.id] ?? item.submission?.photoDataUrl ?? ""}
                        alt={`Homework proof for ${item.title}`}
                        className="max-h-72 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  {item.submission?.submittedAt ? (
                    <p className="text-xs text-muted-foreground">Submitted: {new Date(item.submission.submittedAt).toLocaleString()}</p>
                  ) : null}
                  {item.submission?.feedback ? (
                    <p className="rounded-xl border border-border/60 p-3 text-sm">Teacher feedback: {item.submission.feedback}</p>
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
              <CardTitle>Create homework</CardTitle>
              <CardDescription>Teacher assignment form for class tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={newHomework.title} onChange={(event) => setNewHomework((prev) => ({ ...prev, title: event.target.value }))} />
              <label className="block text-sm">
                Subject
                <select className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm" value={newHomework.subject} onChange={(event) => setNewHomework((prev) => ({ ...prev, subject: event.target.value }))}>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <Input type="number" min={1} max={11} value={newHomework.grade} onChange={(event) => setNewHomework((prev) => ({ ...prev, grade: Number(event.target.value) || 1 }))} />
              <Input placeholder="Topic" value={newHomework.topic} onChange={(event) => setNewHomework((prev) => ({ ...prev, topic: event.target.value }))} />
              <Textarea placeholder="Description" value={newHomework.description} onChange={(event) => setNewHomework((prev) => ({ ...prev, description: event.target.value }))} />
              <Input type="datetime-local" value={newHomework.dueDate} onChange={(event) => setNewHomework((prev) => ({ ...prev, dueDate: event.target.value }))} />
              <Input type="number" min={1} value={newHomework.points} onChange={(event) => setNewHomework((prev) => ({ ...prev, points: Number(event.target.value) || 1 }))} />
              <Button onClick={createHomework}>Create</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Student submissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {teacherHomework.length === 0 ? <p className="text-sm text-muted-foreground">No homework assignments yet.</p> : null}
              {teacherHomework.map((item) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-border/60 p-3">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.subject} • Grade {item.grade} • Due {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                  {item.submissions.length === 0 ? <p className="text-sm text-muted-foreground">No submissions yet.</p> : null}
                  {item.submissions.map((submission) => (
                    <div key={submission.id} className="space-y-2 rounded-xl border border-border/60 p-3">
                      <p className="text-sm font-medium">{submission.studentName}</p>
                      <p className="text-xs text-muted-foreground">{submission.studentEmail}</p>
                      <Badge variant="outline">{submission.status}</Badge>
                      {typeof submission.aiScore === "number" ? <p className="text-xs text-muted-foreground">AI score: {submission.aiScore}/100</p> : null}
                      {submission.submittedAt ? (
                        <p className="text-xs text-muted-foreground">Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">{submission.textAnswer ?? "Empty answer"}</p>
                      {submission.photoDataUrl ? (
                        <div className="overflow-hidden rounded-xl border border-border/60">
                          <img src={submission.photoDataUrl} alt={`Submission proof from ${submission.studentName}`} className="max-h-72 w-full object-cover" />
                        </div>
                      ) : null}
                      <Textarea
                        placeholder="Feedback..."
                        value={feedbackDraft[submission.id] ?? submission.feedback ?? ""}
                        onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, [submission.id]: event.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => reviewSubmission(submission.id, "ACCEPTED")}>
                          ACCEPTED
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reviewSubmission(submission.id, "NEEDS_REVISION")}>
                          NEEDS_REVISION
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
