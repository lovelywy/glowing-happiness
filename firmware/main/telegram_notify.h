#pragma once
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "config.h"

class TelegramNotify {
public:
    // ส่งข้อความแจ้งเตือน — ใช้ HTTPS
    static bool send(const String& message) {
        if (strlen(TELEGRAM_BOT_TOKEN) < 10) return false; // ไม่ได้ config

        WiFiClientSecure client;
        client.setInsecure(); // ข้าม cert verify สำหรับ dev

        HTTPClient http;
        String url = "https://api.telegram.org/bot";
        url += TELEGRAM_BOT_TOKEN;
        url += "/sendMessage";

        http.begin(client, url);
        http.addHeader("Content-Type", "application/json");

        // Escape double quotes ใน message
        String escaped = message;
        escaped.replace("\"", "\\\"");

        String body = "{\"chat_id\":\"" TELEGRAM_CHAT_ID "\","
                      "\"text\":\"" + escaped + "\","
                      "\"parse_mode\":\"HTML\"}";

        int code = http.POST(body);
        http.end();

        Serial.printf("[Telegram] Sent (HTTP %d): %s\n", code,
                      message.substring(0, 40).c_str());
        return code == 200;
    }

    static void alertMotion() {
        send("⚠️ <b>Smart Home Alert</b>\nพบการเคลื่อนไหวในบ้าน!");
    }

    static void alertTemperature(float temp) {
        send("🌡️ <b>อุณหภูมิสูง</b>\nอุณหภูมิ: " + String(temp, 1) + "°C\nเปิดพัดลมอัตโนมัติแล้ว");
    }

    static void alertWatering() {
        send("💧 <b>รดน้ำต้นไม้</b>\nดินแห้ง — เริ่มรดน้ำ 30 วินาที");
    }

    static void alertBoot(const String& ip) {
        send("🟢 <b>Smart Home Online</b>\nIP: " + ip);
    }
};
