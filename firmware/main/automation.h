#pragma once
#include "sensors.h"
#include "relay_controller.h"
#include "config.h"

// กฎ automation ทั้งหมดอยู่ที่นี่
// แยกออกมาให้แก้ไขง่ายโดยไม่ต้องแตะ main.ino

class Automation {
public:
    Automation(RelayController& relay) : _relay(relay) {}

    // เรียกทุกรอบที่อ่าน sensor ใหม่
    void evaluate(const HomeData& d, int currentHour) {
        _handleLight(d, currentHour);
        _handleFan(d);
        _handleWatering(d);
    }

    // ────────────────────────────────────────────────
    // Rule 1: เปิดไฟห้องนั่งเล่น เมื่อมืด + มีคน
    // ────────────────────────────────────────────────
    void _handleLight(const HomeData& d, int hour) {
        bool isNight = (hour >= 18 || hour < 6);
        bool isDark  = d.lightLevel < LDR_DARK;

        if (d.motionDetected && (isDark || isNight)) {
            if (!_relay.isOn(2)) {
                _relay.set(2, true);
                _relay.setAutoOff(2, MOTION_LIGHT_OFF_MS);
            } else {
                // รีเซ็ต timer ถ้ายังมีคนอยู่
                _relay.setAutoOff(2, MOTION_LIGHT_OFF_MS);
            }
        }
    }

    // ────────────────────────────────────────────────
    // Rule 2: เปิด/ปิดพัดลมตามอุณหภูมิ
    // ────────────────────────────────────────────────
    void _handleFan(const HomeData& d) {
        if (!d.climate.valid) return;

        if (d.climate.temperature >= TEMP_HIGH && !_relay.isOn(3)) {
            _relay.set(3, true);
        } else if (d.climate.temperature <= TEMP_LOW && _relay.isOn(3)) {
            _relay.set(3, false);
        }
    }

    // ────────────────────────────────────────────────
    // Rule 3: รดน้ำต้นไม้เมื่อดินแห้ง (ครั้งละ 30 วินาที)
    // ────────────────────────────────────────────────
    void _handleWatering(const HomeData& d) {
        if (d.soilMoisture > SOIL_DRY && !_relay.isOn(4)) {
            _relay.set(4, true);
            _relay.setAutoOff(4, 30000UL); // รด 30 วินาที
        }
    }

private:
    RelayController& _relay;
};
