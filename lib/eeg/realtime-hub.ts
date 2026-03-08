export type EEGRealtimeEvent = {
  readingId: string;
  studentId: string;
  attention: number;
  meditation: number;
  signal: number;
  raw: number;
  engagementScore: number;
  state: string;
  timestamp: string;
  lessonSessionId?: string | null;
  deviceId?: string | null;
};

type Subscriber = {
  id: string;
  studentScope: Set<string> | null;
  push: (event: EEGRealtimeEvent) => void;
};

class EEGRealtimeHub {
  private subscribers = new Map<string, Subscriber>();

  subscribe(studentScope: Set<string> | null, push: Subscriber["push"]) {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    this.subscribers.set(id, { id, studentScope, push });
    return () => {
      this.subscribers.delete(id);
    };
  }

  publish(event: EEGRealtimeEvent) {
    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.studentScope || subscriber.studentScope.has(event.studentId)) {
        subscriber.push(event);
      }
    }
  }
}

const globalHub = globalThis as unknown as { __iuiEegRealtimeHub?: EEGRealtimeHub };

export const eegRealtimeHub = globalHub.__iuiEegRealtimeHub ?? new EEGRealtimeHub();
if (!globalHub.__iuiEegRealtimeHub) {
  globalHub.__iuiEegRealtimeHub = eegRealtimeHub;
}

