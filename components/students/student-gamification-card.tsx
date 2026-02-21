import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateGamification } from "@/lib/gamification";
import { HomeworkItem, TrendPoint } from "@/lib/types";

interface StudentGamificationCardProps {
  trend: TrendPoint[];
  homework: HomeworkItem[];
}

export function StudentGamificationCard({ trend, homework }: StudentGamificationCardProps) {
  const game = calculateGamification(trend, homework);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Прогресс ученика</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <p className="text-3xl font-semibold">{game.xp} XP</p>
          <p className="text-sm text-muted-foreground">Level {game.level}</p>
        </div>
        <Progress value={game.progressPercent} />
        <p className="text-xs text-muted-foreground">
          До следующего уровня: {Math.max(0, game.nextLevelXp - game.xp)} XP
        </p>
        <div className="flex flex-wrap gap-2">
          {game.achievements.map((item) => (
            <span key={item} className="rounded-full border border-border/60 px-2.5 py-1 text-xs">
              {item}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
