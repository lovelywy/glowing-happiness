#pragma once
#include <Arduino.h>
#include "config.h"

class RelayController {
public:
    void begin() {
        const uint8_t pins[] = {PIN_RELAY_1, PIN_RELAY_2, PIN_RELAY_3, PIN_RELAY_4};
        for (uint8_t p : pins) {
            pinMode(p, OUTPUT);
            digitalWrite(p, HIGH); // Active LOW — เริ่มต้นปิดทั้งหมด
        }
    }

    void set(uint8_t relay, bool on) {
        uint8_t pin = _pin(relay);
        if (pin == 0) return;
        digitalWrite(pin, on ? LOW : HIGH); // Active LOW
        _state[relay - 1] = on;
        Serial.printf("[Relay] %d → %s\n", relay, on ? "ON" : "OFF");
    }

    void toggle(uint8_t relay) {
        set(relay, !_state[relay - 1]);
    }

    bool isOn(uint8_t relay) {
        if (relay < 1 || relay > 4) return false;
        return _state[relay - 1];
    }

    // ตั้ง timer ปิดอัตโนมัติ (ms) — 0 = ไม่มี timer
    void setAutoOff(uint8_t relay, unsigned long durationMs) {
        if (relay < 1 || relay > 4) return;
        _autoOff[relay - 1] = durationMs > 0 ? millis() + durationMs : 0;
    }

    void loop() {
        unsigned long now = millis();
        for (uint8_t i = 0; i < 4; i++) {
            if (_autoOff[i] > 0 && now >= _autoOff[i]) {
                set(i + 1, false);
                _autoOff[i] = 0;
            }
        }
    }

private:
    bool _state[4]          = {false, false, false, false};
    unsigned long _autoOff[4] = {0, 0, 0, 0};

    uint8_t _pin(uint8_t relay) {
        switch (relay) {
            case 1: return PIN_RELAY_1;
            case 2: return PIN_RELAY_2;
            case 3: return PIN_RELAY_3;
            case 4: return PIN_RELAY_4;
            default: return 0;
        }
    }
};
