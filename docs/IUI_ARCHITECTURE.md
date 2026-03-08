# IUI Production-like MVP Architecture

## 1. Data flow

1. TGAM sends packets to ESP32 UART.
2. ESP32 parses packet (`attention`, `meditation`, `signal`, `raw`) and POSTs to `POST /api/eeg`.
3. Backend validates payload, verifies device API key, stores `EEGReading`, updates telemetry and XP.
4. Backend publishes event to SSE hub (`/api/realtime/eeg`).
5. Student/Teacher dashboards receive live updates through `EventSource`.
6. AI endpoint (`/api/ai/personalize`) analyzes EEG + attempts and writes:
   - `Assignment`
   - `Homework`
   - `AIRecommendation`

## 2. Access control

- Device access: bearer token checked against hashed key in `Device.apiKeyHash`.
- User access: cookie session + role checks (`student/teacher/admin`).
- Teacher scope: only own classroom students.
- Student scope: only own data.

## 3. Realtime strategy

- Implemented via SSE and in-memory pub/sub hub (`lib/eeg/realtime-hub.ts`).
- Event types:
  - `snapshot`: initial latest readings
  - `eeg`: each new reading
  - `ping`: keep-alive

## 4. AI personalization strategy

- Context:
  - recent EEG history
  - engagement aggregates
  - error rate from attempts
  - lesson subject/topic/grade
- Generation:
  - heuristic fallback always available
  - OpenAI override when `OPENAI_API_KEY` exists
- Persistence:
  - adaptive assignment
  - personalized homework
  - teacher/student recommendations

## 5. Gamification coupling

- EEG focus stream can award XP (`XPProgress`) and level updates (`CharacterProfile`).
- Student dashboard shows level/XP/streak, missions, achievements.

## 6. Deployment notes

- Current realtime hub is single-instance.
- For multi-instance Vercel/Node scaling, replace with Redis pub/sub layer.
- For production DB, use PostgreSQL and run `prisma migrate deploy`.

