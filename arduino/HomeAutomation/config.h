#pragma once

// ─── WiFi ────────────────────────────────────────────────────────────────────
#define WIFI_SSID       "YOUR_SSID"
#define WIFI_PASSWORD   "YOUR_PASSWORD"

// ─── MQTT Broker ─────────────────────────────────────────────────────────────
#define MQTT_HOST       "192.168.1.100"   // IP ของ broker (Mosquitto / Home Assistant)
#define MQTT_PORT       1883
#define MQTT_USER       ""                // ถ้าไม่มี auth ปล่อยว่าง
#define MQTT_PASSWORD   ""
#define MQTT_CLIENT_ID  "home-arduino-01"

// ─── MQTT Topics ─────────────────────────────────────────────────────────────
#define TOPIC_ROOT      "home/arduino01"
#define TOPIC_CMD       TOPIC_ROOT "/cmd/#"        // subscribe: รับคำสั่ง
#define TOPIC_STATUS    TOPIC_ROOT "/status"       // publish:  สถานะรวม (JSON)
#define TOPIC_SENSOR    TOPIC_ROOT "/sensor"       // publish:  ค่าเซ็นเซอร์ (JSON)
#define TOPIC_RELAY     TOPIC_ROOT "/relay"        // publish:  สถานะ relay (JSON)

// ─── Relay Pins (Active-LOW relay board) ─────────────────────────────────────
// แก้ไข pin ให้ตรงกับบอร์ดของคุณ (ESP32 / Arduino Mega)
#define RELAY_COUNT     4

#define RELAY_PIN_0     26    // ห้องนั่งเล่น – ไฟ
#define RELAY_PIN_1     27    // ห้องนอน   – ไฟ
#define RELAY_PIN_2     14    // ห้องนั่งเล่น – พัดลม
#define RELAY_PIN_3     12    // ห้องครัว   – เต้าเสียบ

#define RELAY_ACTIVE    LOW   // relay ทำงานเมื่อ pin = LOW

// ─── Sensor Pins ─────────────────────────────────────────────────────────────
#define DHT_PIN         4     // DHT22 data
#define DHT_TYPE        DHT22

#define PIR_PIN         5     // HC-SR501 PIR output
#define LDR_PIN         34    // LDR (analog – ESP32 ADC1)

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
#define SENSOR_INTERVAL     30000UL   // อ่านเซ็นเซอร์ทุก 30 วิ
#define STATUS_INTERVAL     60000UL   // ส่ง status ทุก 1 นาที
#define RECONNECT_INTERVAL   5000UL   // พยายาม reconnect ทุก 5 วิ

// ─── HTTP REST API (ถ้าใช้ ESP32) ────────────────────────────────────────────
#define HTTP_PORT       80

// ─── OTA ─────────────────────────────────────────────────────────────────────
#define OTA_HOSTNAME    MQTT_CLIENT_ID
#define OTA_PASSWORD    "ota_secret"   // เปลี่ยนก่อนใช้งานจริง
