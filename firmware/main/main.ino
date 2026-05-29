/*
 * ESP32 Smart Home Hub
 * Features: Climate, Motion, Light, Soil, Energy monitoring
 *           + Relay automation + MQTT + Telegram + OLED
 *
 * Required libraries (install via Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary
 *   - ArduinoJson by Benoit Blanchon
 *   - DHT sensor library by Adafruit
 *   - Adafruit GFX Library
 *   - Adafruit SSD1306
 *   - NTPClient by Fabrice Weinberg
 *   - MFRC522 by GithubCommunity (optional — RFID)
 */

#include <NTPClient.h>
#include <WiFiUdp.h>

#include "config.h"
#include "wifi_manager.h"
#include "sensors.h"
#include "relay_controller.h"
#include "mqtt_handler.h"
#include "automation.h"
#include "telegram_notify.h"
#include "oled_display.h"

// ── Global objects ────────────────────────────────────
Sensors          sensors;
RelayController  relays;
MqttHandler      mqtt;
Automation       automation(relays);
OledDisplay      oled;

WiFiUDP   ntpUDP;
NTPClient ntp(ntpUDP, NTP_SERVER, NTP_OFFSET, 60000);

// ── State ─────────────────────────────────────────────
HomeData         lastData;
unsigned long    lastSensorRead  = 0;
unsigned long    lastEnergyRead  = 0;
bool             motionAlertSent = false;

// ── MQTT relay callback (called from mqtt_handler.h) ──
void onRelayCommand(uint8_t relayNum, bool on) {
    relays.set(relayNum, on);

    // แจ้งกลับ status
    char topic[32], msg[4];
    snprintf(topic, sizeof(topic), "home/relay/%d/state", relayNum);
    mqtt.publishAlert(on ? "ON" : "OFF"); // reuse channel
}

// ── Setup ─────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    Serial.println("\n=== Smart Home Boot ===");

    oled.begin();
    oled.showConnecting("Connecting WiFi...");

    WiFiManager::connect();

    oled.showConnecting("Syncing time...");
    ntp.begin();
    ntp.update();

    sensors.begin();
    relays.begin();

    oled.showConnecting("Connecting MQTT...");
    mqtt.begin();

    TelegramNotify::alertBoot(WiFiManager::localIP());

    Serial.println("=== Boot complete ===");
}

// ── Loop ──────────────────────────────────────────────
void loop() {
    WiFiManager::reconnectIfNeeded();
    mqtt.loop();
    relays.loop();   // ตรวจ auto-off timers
    ntp.update();

    unsigned long now = millis();

    // ── อ่าน sensor ทุก INTERVAL_SENSOR ──
    if (now - lastSensorRead >= INTERVAL_SENSOR) {
        lastSensorRead = now;

        lastData = sensors.read();
        int hour = ntp.getHours();

        // Publish ผ่าน MQTT
        if (lastData.climate.valid) {
            mqtt.publishClimate(lastData.climate.temperature,
                                lastData.climate.humidity);
        }
        mqtt.publishMotion(lastData.motionDetected);
        mqtt.publishSoil(lastData.soilMoisture,
                         sensors.isSoilDry(lastData.soilMoisture));

        // ── Motion alert (Telegram ส่งครั้งเดียวต่อ event) ──
        if (lastData.motionDetected && !motionAlertSent) {
            motionAlertSent = true;
            TelegramNotify::alertMotion();
        } else if (!lastData.motionDetected) {
            motionAlertSent = false;
        }

        // ── Temperature alert ──
        static bool fanAlertSent = false;
        if (lastData.climate.valid &&
            lastData.climate.temperature >= TEMP_HIGH && !fanAlertSent) {
            fanAlertSent = true;
            TelegramNotify::alertTemperature(lastData.climate.temperature);
        } else if (lastData.climate.valid &&
                   lastData.climate.temperature < TEMP_HIGH) {
            fanAlertSent = false;
        }

        // ── Watering alert ──
        static bool waterAlertSent = false;
        if (sensors.isSoilDry(lastData.soilMoisture) && !waterAlertSent) {
            waterAlertSent = true;
            TelegramNotify::alertWatering();
        } else if (!sensors.isSoilDry(lastData.soilMoisture)) {
            waterAlertSent = false;
        }

        // ── Automation rules ──
        automation.evaluate(lastData, hour);

        // ── Heartbeat ──
        mqtt.publishStatus(WiFiManager::localIP().c_str());
    }

    // ── อ่านพลังงานถี่กว่า (ทุก 5 วินาที) ──
    if (now - lastEnergyRead >= INTERVAL_ENERGY) {
        lastEnergyRead = now;
        HomeData e = sensors.read();
        mqtt.publishEnergy(e.currentAmps, e.powerWatts);
    }

    // ── อัปเดต OLED ──
    oled.update(lastData, relays);
}
