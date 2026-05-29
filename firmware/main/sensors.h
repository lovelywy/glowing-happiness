#pragma once
#include <DHT.h>
#include "config.h"

struct ClimateData {
    float temperature;
    float humidity;
    bool  valid;
};

struct HomeData {
    ClimateData climate;
    bool  motionDetected;
    int   lightLevel;     // ADC 0–4095
    int   soilMoisture;   // ADC 0–4095 (ต่ำ = ชื้น)
    float currentAmps;    // A
    float powerWatts;     // W (สมมติ 220V)
};

class Sensors {
public:
    Sensors() : _dht(PIN_DHT, DHT22) {}

    void begin() {
        _dht.begin();
        pinMode(PIN_PIR, INPUT);
        // LDR, Soil, Current ใช้ analogRead() โดยตรง
    }

    HomeData read() {
        HomeData d;

        // Climate
        d.climate.temperature = _dht.readTemperature();
        d.climate.humidity    = _dht.readHumidity();
        d.climate.valid = !isnan(d.climate.temperature) &&
                          !isnan(d.climate.humidity);

        // Motion
        d.motionDetected = digitalRead(PIN_PIR) == HIGH;

        // Light (LDR ต่อ voltage divider — ยิ่งมืดค่ายิ่งต่ำ)
        d.lightLevel = analogRead(PIN_LDR);

        // Soil moisture (ยิ่งแห้งค่ายิ่งสูง)
        d.soilMoisture = analogRead(PIN_SOIL);

        // Current via ACS712-5A: Vref=2.5V, sensitivity=185mV/A
        // ESP32 ADC ref 3.3V, 12-bit (0-4095)
        int raw = analogRead(PIN_CURRENT);
        float voltage = raw * (3.3f / 4095.0f);
        d.currentAmps = (voltage - 2.5f) / 0.185f;
        if (d.currentAmps < 0) d.currentAmps = 0;
        d.powerWatts = d.currentAmps * 220.0f;

        return d;
    }

    bool isDark(int lightLevel)    { return lightLevel < LDR_DARK; }
    bool isSoilDry(int soilLevel)  { return soilLevel > SOIL_DRY; }

private:
    DHT _dht;
};
