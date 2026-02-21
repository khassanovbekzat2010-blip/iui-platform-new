import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCardData } from "@/lib/types";

interface StatCardProps {
  stat: StatCardData;
}

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus
};

export function StatCard({ stat }: StatCardProps) {
  const TrendIcon = trendIcon[stat.trend];

  return (
    <Card className="transition-transform duration-200 hover:-translate-y-0.5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground">{stat.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <TrendIcon className="h-3.5 w-3.5" />
          {stat.delta}
        </p>
      </CardContent>
    </Card>
  );
}
