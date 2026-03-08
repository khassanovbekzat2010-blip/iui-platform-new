export interface TgamSignal {
  attention: number;
  meditation: number;
  blink: number;
  signalQuality: number;
}

export function createRandomTgamSignal(seed: number): TgamSignal {
  const base = Math.abs(Math.sin(seed)) * 100;
  return {
    attention: Math.round(45 + (base % 50)),
    meditation: Math.round(40 + ((base * 1.3) % 45)),
    blink: Math.round(20 + ((base * 2.1) % 80)),
    signalQuality: Math.round(70 + ((base * 0.8) % 30))
  };
}

export function summarizeTgamSignals(signals: TgamSignal[]) {
  if (!signals.length) {
    return { attention: 70, meditation: 65, blink: 40, signalQuality: 90 };
  }
  const sum = signals.reduce(
    (acc, signal) => ({
      attention: acc.attention + signal.attention,
      meditation: acc.meditation + signal.meditation,
      blink: acc.blink + signal.blink,
      signalQuality: acc.signalQuality + signal.signalQuality
    }),
    { attention: 0, meditation: 0, blink: 0, signalQuality: 0 }
  );
  return {
    attention: Math.round(sum.attention / signals.length),
    meditation: Math.round(sum.meditation / signals.length),
    blink: Math.round(sum.blink / signals.length),
    signalQuality: Math.round(sum.signalQuality / signals.length)
  };
}
