/*
 * Home Automation Controller — ESP32 / ESP8266
 * ──────────────────────────────────────────────
 * คุณสมบัติ:
 *   • ควบคุม Relay 4 ช่อง ผ่าน MQTT และ HTTP REST API
 *   • อ่านอุณหภูมิ / ความชื้น จาก DHT22
 *   • ตรวจจับการเคลื่อนไหว PIR และ แสงสว่าง LDR
 *   • OTA update ผ่าน Arduino IDE
 *   • Auto-reconnect WiFi / MQTT
 *
 * Dependencies (ติดตั้งผ่าน Library Manager):
 *   PubSubClient  ≥ 2.8
 *   DHT sensor library (Adafruit)
 *   Adafruit Unified Sensor
 *   ArduinoJson   ≥ 7.x
 *   ESPAsyncWebServer + AsyncTCP  (สำหรับ HTTP API)
 *   ArduinoOTA
 *
 * MQTT command format:
 *   Topic: home/arduino01/cmd/relay/<id>   Payload: {"state":"ON"}|{"state":"OFF"}|{"state":"TOGGLE"}
 *   Topic: home/arduino01/cmd/all          Payload: {"state":"OFF"}
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <ESPAsyncWebServer.h>
#include "config.h"

// ─── Global objects ───────────────────────────────────────────────────────────
WiFiClient        wifiClient;
PubSubClient      mqtt(wifiClient);
DHT               dht(DHT_PIN, DHT_TYPE);
AsyncWebServer    httpServer(HTTP_PORT);

// ─── Relay state ──────────────────────────────────────────────────────────────
const uint8_t RELAY_PINS[RELAY_COUNT] = {
    RELAY_PIN_0, RELAY_PIN_1, RELAY_PIN_2, RELAY_PIN_3
};
const char* RELAY_NAMES[RELAY_COUNT] = {
    "living_light", "bedroom_light", "living_fan", "kitchen_outlet"
};
bool relayState[RELAY_COUNT] = {false, false, false, false};

// ─── Sensor cache ─────────────────────────────────────────────────────────────
float   tempC        = 0;
float   humidity     = 0;
bool    motionActive = false;
int     lightLevel   = 0;

// ─── Timers ───────────────────────────────────────────────────────────────────
unsigned long lastSensorRead  = 0;
unsigned long lastStatusSend  = 0;
unsigned long lastReconnect   = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Relay helpers
// ─────────────────────────────────────────────────────────────────────────────
void setRelay(uint8_t id, bool on) {
    if (id >= RELAY_COUNT) return;
    relayState[id] = on;
    digitalWrite(RELAY_PINS[id], on ? RELAY_ACTIVE : !RELAY_ACTIVE);
}

void toggleRelay(uint8_t id) {
    if (id >= RELAY_COUNT) return;
    setRelay(id, !relayState[id]);
}

void allRelaysOff() {
    for (uint8_t i = 0; i < RELAY_COUNT; i++) setRelay(i, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON builders
// ─────────────────────────────────────────────────────────────────────────────
String buildRelayJson() {
    JsonDocument doc;
    for (uint8_t i = 0; i < RELAY_COUNT; i++) {
        doc[RELAY_NAMES[i]] = relayState[i] ? "ON" : "OFF";
    }
    String out;
    serializeJson(doc, out);
    return out;
}

String buildSensorJson() {
    JsonDocument doc;
    doc["temperature"] = tempC;
    doc["humidity"]    = humidity;
    doc["motion"]      = motionActive;
    doc["light"]       = lightLevel;
    String out;
    serializeJson(doc, out);
    return out;
}

String buildStatusJson() {
    JsonDocument doc;
    doc["ip"]     = WiFi.localIP().toString();
    doc["rssi"]   = WiFi.RSSI();
    doc["uptime"] = millis() / 1000;
    JsonObject relays  = doc["relays"].to<JsonObject>();
    for (uint8_t i = 0; i < RELAY_COUNT; i++) {
        relays[RELAY_NAMES[i]] = relayState[i] ? "ON" : "OFF";
    }
    JsonObject sensors = doc["sensors"].to<JsonObject>();
    sensors["temperature"] = tempC;
    sensors["humidity"]    = humidity;
    sensors["motion"]      = motionActive;
    sensors["light"]       = lightLevel;
    String out;
    serializeJson(doc, out);
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT callback
// ─────────────────────────────────────────────────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String topicStr(topic);
    String payloadStr;
    for (unsigned int i = 0; i < length; i++) payloadStr += (char)payload[i];

    Serial.printf("[MQTT] %s → %s\n", topic, payloadStr.c_str());

    JsonDocument doc;
    if (deserializeJson(doc, payloadStr) != DeserializationError::Ok) return;

    // home/arduino01/cmd/all
    if (topicStr.endsWith("/all")) {
        String state = doc["state"] | "";
        if (state == "OFF") allRelaysOff();
        mqtt.publish(TOPIC_RELAY, buildRelayJson().c_str(), true);
        return;
    }

    // home/arduino01/cmd/relay/<id>
    int relayIdx = topicStr.substring(topicStr.lastIndexOf('/') + 1).toInt();
    if (relayIdx < 0 || relayIdx >= RELAY_COUNT) return;

    String state = doc["state"] | "";
    if      (state == "ON")     setRelay(relayIdx, true);
    else if (state == "OFF")    setRelay(relayIdx, false);
    else if (state == "TOGGLE") toggleRelay(relayIdx);

    mqtt.publish(TOPIC_RELAY, buildRelayJson().c_str(), true);
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi / MQTT connect
// ─────────────────────────────────────────────────────────────────────────────
void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;
    Serial.printf("\n[WiFi] เชื่อมต่อ %s ", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print('.');
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] เชื่อมต่อแล้ว IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] ไม่สามารถเชื่อมต่อได้ — จะลองใหม่");
    }
}

bool connectMQTT() {
    if (mqtt.connected()) return true;
    Serial.printf("[MQTT] เชื่อมต่อ %s:%d… ", MQTT_HOST, MQTT_PORT);
    bool ok = strlen(MQTT_USER) > 0
        ? mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)
        : mqtt.connect(MQTT_CLIENT_ID);

    if (ok) {
        Serial.println("สำเร็จ");
        mqtt.subscribe(TOPIC_CMD);
        mqtt.publish(TOPIC_STATUS, buildStatusJson().c_str(), true);
    } else {
        Serial.printf("ล้มเหลว rc=%d\n", mqtt.state());
    }
    return ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP REST API
// ─────────────────────────────────────────────────────────────────────────────
void setupHttpServer() {
    // GET /api/status
    httpServer.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", buildStatusJson());
    });

    // GET /api/relay
    httpServer.on("/api/relay", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", buildRelayJson());
    });

    // GET /api/sensor
    httpServer.on("/api/sensor", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "application/json", buildSensorJson());
    });

    // POST /api/relay/<id>  body: {"state":"ON"|"OFF"|"TOGGLE"}
    httpServer.on("/api/relay", HTTP_POST, [](AsyncWebServerRequest* req) {},
        nullptr,
        [](AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
            String url  = req->url();               // /api/relay/0
            int    last = url.lastIndexOf('/');
            int    id   = url.substring(last + 1).toInt();

            JsonDocument doc;
            deserializeJson(doc, (char*)data, len);
            String state = doc["state"] | "";

            if (id >= 0 && id < RELAY_COUNT) {
                if      (state == "ON")     setRelay(id, true);
                else if (state == "OFF")    setRelay(id, false);
                else if (state == "TOGGLE") toggleRelay(id);
                mqtt.publish(TOPIC_RELAY, buildRelayJson().c_str(), true);
                req->send(200, "application/json", buildRelayJson());
            } else {
                req->send(400, "application/json", "{\"error\":\"invalid relay id\"}");
            }
        }
    );

    // POST /api/all/off
    httpServer.on("/api/all/off", HTTP_POST, [](AsyncWebServerRequest* req) {
        allRelaysOff();
        mqtt.publish(TOPIC_RELAY, buildRelayJson().c_str(), true);
        req->send(200, "application/json", buildRelayJson());
    });

    // 404
    httpServer.onNotFound([](AsyncWebServerRequest* req) {
        req->send(404, "application/json", "{\"error\":\"not found\"}");
    });

    httpServer.begin();
    Serial.printf("[HTTP] เริ่มที่ port %d\n", HTTP_PORT);
}

// ─────────────────────────────────────────────────────────────────────────────
// OTA
// ─────────────────────────────────────────────────────────────────────────────
void setupOTA() {
    ArduinoOTA.setHostname(OTA_HOSTNAME);
    ArduinoOTA.setPassword(OTA_PASSWORD);
    ArduinoOTA.onStart([]()  { Serial.println("[OTA] เริ่ม update"); });
    ArduinoOTA.onEnd([]()    { Serial.println("\n[OTA] เสร็จสิ้น"); });
    ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
        Serial.printf("[OTA] %u%%\r", p * 100 / t);
    });
    ArduinoOTA.onError([](ota_error_t e) {
        Serial.printf("[OTA] Error[%u]\n", e);
    });
    ArduinoOTA.begin();
    Serial.printf("[OTA] พร้อมที่ hostname: %s\n", OTA_HOSTNAME);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensor read
// ─────────────────────────────────────────────────────────────────────────────
void readSensors() {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) tempC    = t;
    if (!isnan(h)) humidity = h;

    motionActive = digitalRead(PIR_PIN) == HIGH;
    lightLevel   = analogRead(LDR_PIN);       // 0-4095 (12-bit ADC ESP32)

    Serial.printf("[Sensor] %.1f°C  %.0f%%  motion=%s  light=%d\n",
        tempC, humidity, motionActive ? "YES" : "no", lightLevel);

    mqtt.publish(TOPIC_SENSOR, buildSensorJson().c_str(), true);
}

// ─────────────────────────────────────────────────────────────────────────────
// setup / loop
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    Serial.println("\n=== Home Automation Controller ===");

    // Relay pins
    for (uint8_t i = 0; i < RELAY_COUNT; i++) {
        pinMode(RELAY_PINS[i], OUTPUT);
        setRelay(i, false);   // ปิดทุก relay เมื่อเริ่มต้น
    }

    // Sensor pins
    dht.begin();
    pinMode(PIR_PIN, INPUT);

    connectWiFi();
    setupOTA();

    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(512);
    connectMQTT();

    setupHttpServer();

    // อ่านค่าเซ็นเซอร์ครั้งแรก
    readSensors();
    lastSensorRead = millis();
    lastStatusSend = millis();
}

void loop() {
    ArduinoOTA.handle();

    // WiFi reconnect
    if (WiFi.status() != WL_CONNECTED) {
        if (millis() - lastReconnect >= RECONNECT_INTERVAL) {
            lastReconnect = millis();
            connectWiFi();
        }
        return;
    }

    // MQTT reconnect
    if (!mqtt.connected()) {
        if (millis() - lastReconnect >= RECONNECT_INTERVAL) {
            lastReconnect = millis();
            connectMQTT();
        }
    }
    mqtt.loop();

    // อ่านเซ็นเซอร์
    if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
        lastSensorRead = millis();
        readSensors();
    }

    // ส่ง status รวม
    if (millis() - lastStatusSend >= STATUS_INTERVAL) {
        lastStatusSend = millis();
        mqtt.publish(TOPIC_STATUS, buildStatusJson().c_str(), true);
    }
}
