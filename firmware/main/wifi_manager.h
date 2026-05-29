#pragma once
#include <WiFi.h>
#include "config.h"

class WiFiManager {
public:
    static void connect() {
        Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
        WiFi.mode(WIFI_STA);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            Serial.print(".");
            attempts++;
        }

        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("\n[WiFi] Connected. IP: %s\n",
                          WiFi.localIP().toString().c_str());
        } else {
            Serial.println("\n[WiFi] Failed — restarting...");
            ESP.restart();
        }
    }

    static bool isConnected() {
        return WiFi.status() == WL_CONNECTED;
    }

    static void reconnectIfNeeded() {
        if (!isConnected()) {
            Serial.println("[WiFi] Reconnecting...");
            connect();
        }
    }

    static String localIP() {
        return WiFi.localIP().toString();
    }
};
