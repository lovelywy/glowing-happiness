#pragma once

// ── WiFi ─────────────────────────────────────────────
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ── MQTT Broker ───────────────────────────────────────
#define MQTT_SERVER   "192.168.1.100"
#define MQTT_PORT     1883
#define MQTT_USER     ""           // ปล่อยว่างถ้าไม่ได้ตั้ง auth
#define MQTT_PASS     ""
#define MQTT_CLIENT_ID "esp32-smarthome"

// ── Telegram ──────────────────────────────────────────
#define TELEGRAM_BOT_TOKEN "YOUR_BOT_TOKEN"
#define TELEGRAM_CHAT_ID   "YOUR_CHAT_ID"

// ── NTP ───────────────────────────────────────────────
#define NTP_SERVER    "pool.ntp.org"
#define NTP_OFFSET    25200        // UTC+7 (วินาที)

// ── Pin Assignments (ESP32) ───────────────────────────
#define PIN_DHT        4
#define PIN_PIR        5
#define PIN_LDR       34
#define PIN_SOIL      35
#define PIN_CURRENT   36

// Relay (Active LOW)
#define PIN_RELAY_1   13   // ไฟห้องนอน
#define PIN_RELAY_2   14   // ไฟห้องนั่งเล่น
#define PIN_RELAY_3   15   // พัดลม / AC
#define PIN_RELAY_4   16   // ระบบรดน้ำ

// OLED I2C
#define PIN_SDA       21
#define PIN_SCL       22

// RFID RC522
#define PIN_RFID_SS    2
#define PIN_RFID_RST  17

// ── Thresholds ────────────────────────────────────────
#define TEMP_HIGH     29.0f   // องศา — เปิดพัดลม
#define TEMP_LOW      24.0f   // องศา — ปิดพัดลม
#define LDR_DARK      500     // ค่า ADC ที่ถือว่า "มืด"
#define SOIL_DRY      400     // ค่า ADC ที่ถือว่า "ดินแห้ง"
#define MOTION_LIGHT_OFF_MS  300000UL   // ปิดไฟหลัง 5 นาที

// ── MQTT Topics ───────────────────────────────────────
#define TOPIC_CLIMATE    "home/sensor/climate"
#define TOPIC_MOTION     "home/sensor/motion"
#define TOPIC_SOIL       "home/sensor/soil"
#define TOPIC_ENERGY     "home/sensor/energy"
#define TOPIC_RELAY_1    "home/relay/1"
#define TOPIC_RELAY_2    "home/relay/2"
#define TOPIC_RELAY_3    "home/relay/3"
#define TOPIC_RELAY_4    "home/relay/4"
#define TOPIC_STATUS     "home/status"
#define TOPIC_ALERT      "home/alert"

// ── Intervals (ms) ────────────────────────────────────
#define INTERVAL_SENSOR  10000UL   // อ่าน sensor ทุก 10 วินาที
#define INTERVAL_ENERGY  5000UL    // อ่านพลังงานทุก 5 วินาที
#define INTERVAL_OLED    3000UL    // สลับหน้า OLED ทุก 3 วินาที
