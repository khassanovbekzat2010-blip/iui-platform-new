import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickAction } from "@/lib/types";

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick?: (actionId: string) => void;
  onAssistantClick?: () => void;
}

export function QuickActions({ actions, onActionClick, onAssistantClick }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Frequently used AI workflows</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onActionClick?.(action.id)}
            className="w-full rounded-xl border border-border/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-accent/40"
          >
            <p className="font-medium">{action.title}</p>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </button>
        ))}
        <Button className="w-full" variant="secondary" onClick={onAssistantClick}>
          Open AI Assistant
        </Button>
      </CardContent>
    </Card>
  );
}
