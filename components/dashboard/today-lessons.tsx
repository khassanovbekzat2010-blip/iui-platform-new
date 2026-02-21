import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonSummary } from "@/lib/types";

interface TodayLessonsProps {
  lessons: LessonSummary[];
  onLessonClick?: (lessonId: string) => void;
}

export function TodayLessons({ lessons, onLessonClick }: TodayLessonsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Today&apos;s Lessons
        </CardTitle>
        <CardDescription>Upcoming and active classes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            onClick={() => onLessonClick?.(lesson.id)}
            className="w-full rounded-xl border border-border/60 p-3 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{lesson.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {lesson.classroom} • {lesson.time}
                </p>
              </div>
              <Badge variant="outline">{lesson.attendees} students</Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
