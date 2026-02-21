import { BrainCircuit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface EngagementMeterProps {
  percent: number;
  stateLabel: string;
  dropMoments?: string[];
}

export function EngagementMeter({ percent, stateLabel, dropMoments = [] }: EngagementMeterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          EEG Engagement Live
        </CardTitle>
        <CardDescription>Real-time class concentration signal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <p className="text-4xl font-semibold">{percent}%</p>
          <Badge variant="success">{stateLabel}</Badge>
        </div>
        <Progress value={percent} />
        <div>
          <p className="text-xs text-muted-foreground">Моменты падения внимания</p>
          {dropMoments.length ? (
            <p className="mt-1 text-sm">{dropMoments.join(", ")}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Падений не зафиксировано.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
