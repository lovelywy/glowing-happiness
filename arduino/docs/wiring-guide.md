# Wiring Guide — Home Automation Controller

## บอร์ดที่รองรับ

| บอร์ด | หมายเหตุ |
|-------|---------|
| ESP32 (แนะนำ) | มี WiFi/BT ในตัว, ADC 12-bit, dual-core |
| ESP8266 (NodeMCU) | ราคาถูกกว่า, pin น้อยกว่า |

---

## วงจร Relay Module (4-Channel)

```
ESP32 GPIO          Relay Module
──────────────────────────────────
3.3V  ──────────── VCC
GND   ──────────── GND
GPIO26 ─────────── IN1   → ไฟห้องนั่งเล่น
GPIO27 ─────────── IN2   → ไฟห้องนอน
GPIO14 ─────────── IN3   → พัดลมห้องนั่งเล่น
GPIO12 ─────────── IN4   → เต้าเสียบห้องครัว
```

> **หมายเหตุ:** Relay module ส่วนใหญ่เป็น Active-LOW  
> ตั้งค่า `RELAY_ACTIVE LOW` ใน `config.h` (ค่า default)

### ต่อสายไฟ AC (220V)
```
สายไฟบ้าน → COM (Common)
โหลด (หลอดไฟ/พัดลม) → NO (Normally Open)
```

---

## วงจร DHT22 (อุณหภูมิ/ความชื้น)

```
ESP32 GPIO          DHT22
──────────────────────────
3.3V  ──────────── Pin 1 (VCC)
GPIO4  ─────────── Pin 2 (DATA)  + ต่อตัวต้านทาน 10kΩ ขึ้น 3.3V
(ไม่ต่อ)          Pin 3
GND   ──────────── Pin 4 (GND)
```

---

## วงจร PIR (HC-SR501)

```
ESP32 GPIO          HC-SR501
──────────────────────────────
5V    ──────────── VCC
GPIO5  ─────────── OUT
GND   ──────────── GND
```

> ปรับ sensitivity และ delay ได้ที่ตัว trimpot บนโมดูล

---

## วงจร LDR (ตรวจแสง)

```
3.3V ──[LDR]──┬── GPIO34 (ADC)
              │
             [10kΩ]
              │
             GND
```

---

## Power Supply

- ESP32 ใช้ไฟ 3.3V (จาก USB หรือ AMS1117-3.3)
- Relay module ควรใช้ไฟแยก 5V เพื่อป้องกัน noise รบกวน MCU
- ต่อ GND ร่วมกัน (Common Ground)

---

## Pin Summary

| Component | Pin ESP32 | ฟังก์ชัน |
|-----------|-----------|---------|
| Relay 0   | GPIO 26   | ไฟห้องนั่งเล่น |
| Relay 1   | GPIO 27   | ไฟห้องนอน |
| Relay 2   | GPIO 14   | พัดลม |
| Relay 3   | GPIO 12   | เต้าเสียบ |
| DHT22     | GPIO 4    | Temp/Humidity |
| PIR       | GPIO 5    | Motion |
| LDR       | GPIO 34   | Light level |

แก้ไข pin ได้ใน `HomeAutomation/config.h`
