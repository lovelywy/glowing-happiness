#pragma once
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "sensors.h"
#include "relay_controller.h"

#define OLED_WIDTH  128
#define OLED_HEIGHT  64
#define OLED_ADDR  0x3C

class OledDisplay {
public:
    OledDisplay() : _display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1) {}

    void begin() {
        Wire.begin(PIN_SDA, PIN_SCL);
        if (!_display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
            Serial.println("[OLED] Init failed");
            _ok = false;
            return;
        }
        _display.setTextColor(SSD1306_WHITE);
        showSplash();
    }

    void showSplash() {
        if (!_ok) return;
        _display.clearDisplay();
        _display.setTextSize(1);
        _display.setCursor(15, 20);
        _display.println("Smart Home v1.0");
        _display.setCursor(25, 35);
        _display.println("Starting up...");
        _display.display();
    }

    // สลับระหว่างหน้า climate และหน้า relay status
    void update(const HomeData& d, RelayController& relay) {
        if (!_ok) return;
        if (millis() - _lastSwitch > INTERVAL_OLED) {
            _page = (_page + 1) % 2;
            _lastSwitch = millis();
        }
        _page == 0 ? _showClimate(d) : _showRelays(relay);
    }

    void showConnecting(const char* msg) {
        if (!_ok) return;
        _display.clearDisplay();
        _display.setTextSize(1);
        _display.setCursor(0, 0);
        _display.println(msg);
        _display.display();
    }

private:
    Adafruit_SSD1306 _display;
    bool _ok = true;
    uint8_t _page = 0;
    unsigned long _lastSwitch = 0;

    void _showClimate(const HomeData& d) {
        _display.clearDisplay();
        _display.setTextSize(1);

        // หัวข้อ
        _display.setCursor(0, 0);
        _display.println("=== Climate ===");

        if (d.climate.valid) {
            _display.setTextSize(2);
            _display.setCursor(0, 16);
            _display.printf("%.1f C", d.climate.temperature);
            _display.setTextSize(1);
            _display.setCursor(0, 40);
            _display.printf("Humidity: %.0f%%", d.climate.humidity);
        } else {
            _display.setCursor(0, 20);
            _display.println("Sensor error!");
        }

        _display.setCursor(0, 52);
        _display.printf("Motion: %s  Light:%d",
                        d.motionDetected ? "YES" : "no",
                        d.lightLevel);
        _display.display();
    }

    void _showRelays(RelayController& relay) {
        _display.clearDisplay();
        _display.setTextSize(1);
        _display.setCursor(0, 0);
        _display.println("=== Relays ===");

        const char* names[] = {"Bedroom", "Living", "Fan", "Water"};
        for (uint8_t i = 1; i <= 4; i++) {
            _display.setCursor(0, 8 + i * 12);
            _display.printf("%d %-8s [%s]", i, names[i - 1],
                            relay.isOn(i) ? "ON " : "OFF");
        }
        _display.display();
    }
};
