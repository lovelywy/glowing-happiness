#pragma once
#include <PubSubClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Forward declaration — ต้องนิยามใน main.ino
void onRelayCommand(uint8_t relayNum, bool on);

class MqttHandler {
public:
    MqttHandler() : _client(_wifiClient) {}

    void begin() {
        _client.setServer(MQTT_SERVER, MQTT_PORT);
        _client.setCallback(_callback);
        _client.setBufferSize(512);
        reconnect();
    }

    void loop() {
        if (!_client.connected()) reconnect();
        _client.loop();
    }

    // ── Publish helpers ───────────────────────────────

    void publishClimate(float temp, float hum) {
        StaticJsonDocument<128> doc;
        doc["temp"] = serialized(String(temp, 1));
        doc["humidity"] = serialized(String(hum, 1));
        _publish(TOPIC_CLIMATE, doc);
    }

    void publishMotion(bool detected) {
        _client.publish(TOPIC_MOTION, detected ? "DETECTED" : "CLEAR");
    }

    void publishSoil(int raw, bool dry) {
        StaticJsonDocument<64> doc;
        doc["raw"] = raw;
        doc["status"] = dry ? "DRY" : "OK";
        _publish(TOPIC_SOIL, doc);
    }

    void publishEnergy(float amps, float watts) {
        StaticJsonDocument<64> doc;
        doc["amps"]  = serialized(String(amps, 2));
        doc["watts"] = serialized(String(watts, 1));
        _publish(TOPIC_ENERGY, doc);
    }

    void publishAlert(const char* message) {
        _client.publish(TOPIC_ALERT, message);
    }

    void publishStatus(const char* ip) {
        StaticJsonDocument<128> doc;
        doc["status"] = "online";
        doc["ip"]     = ip;
        doc["uptime"] = millis() / 1000;
        _publish(TOPIC_STATUS, doc);
    }

    bool connected() { return _client.connected(); }

private:
    WiFiClient   _wifiClient;
    PubSubClient _client;

    void reconnect() {
        int retries = 0;
        while (!_client.connected() && retries < 5) {
            Serial.print("[MQTT] Connecting...");
            bool ok = strlen(MQTT_USER) > 0
                ? _client.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)
                : _client.connect(MQTT_CLIENT_ID);

            if (ok) {
                Serial.println(" connected.");
                // Subscribe ทุก relay topic
                _client.subscribe(TOPIC_RELAY_1);
                _client.subscribe(TOPIC_RELAY_2);
                _client.subscribe(TOPIC_RELAY_3);
                _client.subscribe(TOPIC_RELAY_4);
            } else {
                Serial.printf(" failed (rc=%d), retry %d/5\n",
                              _client.state(), ++retries);
                delay(3000);
            }
        }
    }

    void _publish(const char* topic, JsonDocument& doc) {
        char buf[256];
        serializeJson(doc, buf);
        _client.publish(topic, buf);
    }

    // Static callback — วน dispatch ไปที่ handler หลัก
    static void _callback(char* topic, byte* payload, unsigned int len) {
        String msg;
        msg.reserve(len);
        for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
        msg.trim();
        msg.toUpperCase();

        bool on = (msg == "ON" || msg == "1" || msg == "TRUE");

        String t(topic);
        if      (t == TOPIC_RELAY_1) onRelayCommand(1, on);
        else if (t == TOPIC_RELAY_2) onRelayCommand(2, on);
        else if (t == TOPIC_RELAY_3) onRelayCommand(3, on);
        else if (t == TOPIC_RELAY_4) onRelayCommand(4, on);
    }
};
