#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <time.h>

const char* ssid = "S7ROBOTICS";
const char* password = "12341234";

const char* backendUrl = "http://172.20.10.3:3000/api/eeg";
const char* deviceId = "esp32_device_1";
const char* deviceApiKey = "5d9e1a594c5e1b9dfc4ddb8b0108e37ecd16ad262ce1e274";
const char* studentId = "student_1";

WebServer server(80);

int attention = 72;
int meditation = 61;
int poorSignal = 18;
int rawValue = 0;

bool simulatorReady = false;
unsigned long lastSampleAt = 0;
unsigned long lastPostAt = 0;
unsigned long lastWifiRetryAt = 0;
unsigned long okPosts = 0;
unsigned long failPosts = 0;
unsigned long dropoutUntil = 0;

const unsigned long sampleIntervalMs = 180;
const unsigned long postIntervalMs = 1200;
const unsigned long wifiRetryMs = 10000;
const unsigned long simulatorFreshMs = 3000;

const char webpage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IUI ESP32 EEG Simulator</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; margin: 0; padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .card { background: #172033; border-radius: 16px; padding: 16px; }
    .label { font-size: 13px; opacity: 0.7; }
    .value { font-size: 30px; font-weight: 700; margin-top: 8px; }
    .meta { margin-top: 12px; background: #172033; border-radius: 16px; padding: 16px; font-size: 13px; opacity: 0.85; }
  </style>
</head>
<body>
  <h1>IUI EEG Sender</h1>
  <div class="grid">
    <div class="card"><div class="label">Attention</div><div class="value" id="attention">-</div></div>
    <div class="card"><div class="label">Meditation</div><div class="value" id="meditation">-</div></div>
    <div class="card"><div class="label">Signal</div><div class="value" id="signal">-</div></div>
    <div class="card"><div class="label">Raw EEG</div><div class="value" id="raw">-</div></div>
  </div>
  <div class="meta">
    <div id="wifi">Wi-Fi: ...</div>
    <div id="sim">Simulator: ...</div>
    <div id="post">Posts: ...</div>
    <div id="device">Device: ...</div>
  </div>
  <script>
    async function refreshData() {
      try {
        const res = await fetch('/data');
        const data = await res.json();
        attention.textContent = data.attention;
        meditation.textContent = data.meditation;
        signal.textContent = data.signal;
        raw.textContent = data.raw;
        wifi.textContent = `Wi-Fi: ${data.wifi}`;
        sim.textContent = `Simulator: ${data.sim}`;
        post.textContent = `Posts: ok=${data.okPosts}, fail=${data.failPosts}, last=${data.lastPost}`;
        device.textContent = `Device: ${data.deviceId}`;
      } catch (error) {
        post.textContent = "Posts: local monitor fetch failed";
      }
    }
    setInterval(refreshData, 1000);
    refreshData();
  </script>
</body>
</html>
)rawliteral";

String wifiStatusText() {
  return WiFi.status() == WL_CONNECTED ? "connected " + WiFi.localIP().toString() : "disconnected";
}

String tgamStatusText() {
  if (!simulatorReady) return "booting";
  if (millis() - lastSampleAt > simulatorFreshMs) return "stale";
  if (millis() < dropoutUntil) return "attention dip";
  if (poorSignal <= 25) return "good";
  if (poorSignal <= 50) return "medium";
  return "weak";
}

long getEpochSeconds() {
  time_t now = time(nullptr);
  if (now > 100000) return (long)now;
  return (long)(millis() / 1000);
}

void handleRoot() {
  server.send(200, "text/html", webpage);
}

void handleData() {
  String json = "{";
  json += "\"attention\":" + String(attention) + ",";
  json += "\"meditation\":" + String(meditation) + ",";
  json += "\"signal\":" + String(poorSignal) + ",";
  json += "\"raw\":" + String(rawValue) + ",";
  json += "\"wifi\":\"" + wifiStatusText() + "\",";
  json += "\"sim\":\"" + tgamStatusText() + "\",";
  json += "\"okPosts\":" + String(okPosts) + ",";
  json += "\"failPosts\":" + String(failPosts) + ",";
  json += "\"lastPost\":\"" + String((okPosts + failPosts) == 0 ? "never" : (failPosts > 0 ? "check serial" : "ok")) + "\",";
  json += "\"deviceId\":\"" + String(deviceId) + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiRetryAt < wifiRetryMs) return;
  lastWifiRetryAt = now;

  Serial.println("[IUI] Reconnecting Wi-Fi...");
  WiFi.disconnect();
  WiFi.begin(ssid, password);
}

bool hasFreshTgamData() {
  return simulatorReady && (millis() - lastSampleAt <= simulatorFreshMs);
}

int clampValue(int value, int minValue, int maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

void simulateEEG() {
  unsigned long now = millis();
  if (now - lastSampleAt < sampleIntervalMs) return;
  lastSampleAt = now;

  float seconds = now / 1000.0f;
  float focusWave = sinf(seconds * 0.21f);
  float calmWave = sinf(seconds * 0.13f + 1.4f);
  float rawWaveFast = sinf(seconds * 4.6f);
  float rawWaveSlow = sinf(seconds * 1.2f + 0.7f);

  if (dropoutUntil == 0 && random(0, 1000) < 8) {
    dropoutUntil = now + random(5000, 12000);
  }

  bool inDropout = now < dropoutUntil;
  if (!inDropout && dropoutUntil != 0) {
    dropoutUntil = 0;
  }

  int attentionTarget = inDropout
    ? 34 + (int)(focusWave * 7.0f) + random(-6, 7)
    : 74 + (int)(focusWave * 10.0f) + random(-5, 6);

  int meditationTarget = inDropout
    ? 48 + (int)(calmWave * 9.0f) + random(-5, 6)
    : 63 + (int)(calmWave * 11.0f) + random(-4, 5);

  attention = clampValue((attention * 4 + attentionTarget) / 5, 20, 96);
  meditation = clampValue((meditation * 4 + meditationTarget) / 5, 25, 94);
  poorSignal = clampValue(inDropout ? random(35, 85) : random(5, 30), 0, 200);

  int rawTarget = (int)(rawWaveFast * 1400.0f) + (int)(rawWaveSlow * 600.0f) + random(-220, 221);
  rawValue = clampValue(rawTarget, -3200, 3200);

  simulatorReady = true;
}

void sendEEGToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!hasFreshTgamData()) return;

  unsigned long now = millis();
  if (now - lastPostAt < postIntervalMs) return;
  lastPostAt = now;

  HTTPClient http;
  http.setTimeout(5000);
  http.begin(backendUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + deviceApiKey);

  String body = "{";
  body += "\"studentId\":\"" + String(studentId) + "\",";
  body += "\"attention\":" + String(attention) + ",";
  body += "\"meditation\":" + String(meditation) + ",";
  body += "\"signal\":" + String(poorSignal) + ",";
  body += "\"raw\":" + String(rawValue) + ",";
  body += "\"deviceId\":\"" + String(deviceId) + "\",";
  body += "\"timestamp\":" + String(getEpochSeconds());
  body += "}";

  int httpCode = http.POST(body);
  String responseBody = http.getString();

  if (httpCode > 0 && httpCode < 400) {
    okPosts++;
    Serial.printf("[IUI] POST /api/eeg -> %d | attention=%d meditation=%d signal=%d raw=%d\n", httpCode, attention, meditation, poorSignal, rawValue);
  } else {
    failPosts++;
    Serial.printf("[IUI] POST failed -> code=%d error=%s response=%s\n", httpCode, http.errorToString(httpCode).c_str(), responseBody.c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1200);
  randomSeed((uint32_t)esp_random());

  Serial.println();
  Serial.println("[IUI] ESP32 EEG simulator starting...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[IUI] Connecting to Wi-Fi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[IUI] Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("[IUI] Wi-Fi connection failed. Device will keep retrying.");
  }

  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();

  Serial.println("[IUI] Local monitor started");
  Serial.printf("[IUI] Device ID: %s\n", deviceId);
  Serial.printf("[IUI] Student ID: %s\n", studentId);
  Serial.printf("[IUI] Backend URL: %s\n", backendUrl);
}

void loop() {
  ensureWifi();
  simulateEEG();
  sendEEGToBackend();
  server.handleClient();
}
