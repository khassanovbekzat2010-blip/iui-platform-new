#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <time.h>

HardwareSerial brain(2);

#define TGAM_RX 16
#define TGAM_TX 17

const char* ssid = "S7ROBOTICS";
const char* password = "12341234";

const char* backendUrl = "http://172.20.10.3:3000/api/eeg";
const char* deviceId = "esp32_device_1";
const char* deviceApiKey = "5d9e1a594c5e1b9dfc4ddb8b0108e37ecd16ad262ce1e274";

WebServer server(80);

int attention = 0;
int meditation = 0;
int poorSignal = 200;
int rawValue = 0;

bool tgAmSeen = false;
unsigned long lastTgamAt = 0;
unsigned long lastPostAt = 0;
unsigned long lastWifiRetryAt = 0;
unsigned long okPosts = 0;
unsigned long failPosts = 0;

const unsigned long postIntervalMs = 1200;
const unsigned long wifiRetryMs = 10000;
const unsigned long tgamFreshMs = 3000;

const char webpage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IUI ESP32 TGAM</title>
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
    <div id="tgam">TGAM: ...</div>
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
        tgam.textContent = `TGAM: ${data.tgam}`;
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
  if (!tgAmSeen) return "no packets yet";
  if (millis() - lastTgamAt > tgamFreshMs) return "stale";
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
  json += "\"tgam\":\"" + tgamStatusText() + "\",";
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
  return tgAmSeen && (millis() - lastTgamAt <= tgamFreshMs);
}

void parsePayload(byte* payload, int length) {
  int i = 0;
  while (i < length) {
    switch (payload[i]) {
      case 0x02:
        if (i + 1 < length) poorSignal = payload[i + 1];
        i += 2;
        break;
      case 0x04:
        if (i + 1 < length) attention = payload[i + 1];
        i += 2;
        break;
      case 0x05:
        if (i + 1 < length) meditation = payload[i + 1];
        i += 2;
        break;
      case 0x80:
        if (i + 3 < length) {
          rawValue = (payload[i + 2] << 8) | payload[i + 3];
          if (rawValue > 32767) rawValue -= 65536;
        }
        i += 4;
        break;
      case 0x83:
        i += 26;
        break;
      default:
        i++;
        break;
    }
  }
}

bool readTGAMPacket() {
  static byte payload[64];

  if (!brain.available()) return false;
  if (brain.read() != 0xAA) return false;

  while (!brain.available()) {}
  if (brain.read() != 0xAA) return false;

  while (!brain.available()) {}
  int payloadLength = brain.read();
  if (payloadLength <= 0 || payloadLength > 64) return false;

  byte checksum = 0;
  for (int i = 0; i < payloadLength; i++) {
    while (!brain.available()) {}
    payload[i] = brain.read();
    checksum += payload[i];
  }

  while (!brain.available()) {}
  byte receivedChecksum = brain.read();
  checksum = 255 - checksum;
  if (checksum != receivedChecksum) return false;

  parsePayload(payload, payloadLength);
  tgAmSeen = true;
  lastTgamAt = millis();
  return true;
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

  Serial.println();
  Serial.println("[IUI] ESP32 TGAM sender starting...");

  brain.begin(57600, SERIAL_8N1, TGAM_RX, TGAM_TX);
  Serial.println("[IUI] TGAM serial started on UART2");

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
  Serial.printf("[IUI] Backend URL: %s\n", backendUrl);
}

void loop() {
  ensureWifi();
  readTGAMPacket();
  sendEEGToBackend();
  server.handleClient();
}
