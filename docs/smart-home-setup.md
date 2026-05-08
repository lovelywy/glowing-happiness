# Smart Home Setup Guide

## Architecture

```
[ESP32 + Sensors] ──WiFi──► [Mosquitto MQTT]
                                    │
                             [Node-RED Flow]
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              [Dashboard]    [Automations]   [Telegram Bot]
              localhost:1880
```

---

## 1. Wiring Diagram

```
ESP32 DevKit v1
┌────────────────────────────────┐
│  3V3 ──── DHT22 VCC            │
│  GND ──── DHT22 GND            │
│  G4  ──── DHT22 DATA           │
│                                │
│  5V  ──── PIR VCC              │
│  GND ──── PIR GND              │
│  G5  ──── PIR OUT              │
│                                │
│  3V3 ──── LDR ──┬── 10kΩ ── GND│
│  G34 ──────────┘               │
│                                │
│  3V3 ── Soil VCC               │
│  GND ── Soil GND               │
│  G35 ── Soil AO                │
│                                │
│  5V  ── ACS712 VCC             │
│  GND ── ACS712 GND             │
│  G36 ── ACS712 OUT             │
│                                │
│  5V  ──── Relay VCC            │
│  GND ──── Relay GND            │
│  G13 ──── Relay IN1 (ห้องนอน)  │
│  G14 ──── Relay IN2 (นั่งเล่น) │
│  G15 ──── Relay IN3 (พัดลม)    │
│  G16 ──── Relay IN4 (รดน้ำ)    │
│                                │
│  G21 ──── OLED SDA             │
│  G22 ──── OLED SCL             │
│  3V3 ──── OLED VCC             │
│  GND ──── OLED GND             │
└────────────────────────────────┘
```

---

## 2. MQTT Broker (Mosquitto)

### ติดตั้งบน Raspberry Pi / Ubuntu

```bash
sudo apt update && sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

### ตรวจสอบ

```bash
# Terminal 1 — subscribe
mosquitto_sub -h localhost -t "home/#" -v

# Terminal 2 — test publish
mosquitto_pub -h localhost -t "home/relay/1" -m "ON"
```

---

## 3. Node-RED Dashboard

```bash
# ติดตั้ง Node-RED
npm install -g --unsafe-perm node-red

# ติดตั้ง Dashboard plugin
cd ~/.node-red
npm install node-red-dashboard

# รัน
node-red
```

จากนั้น:
1. เปิด `http://localhost:1880`
2. **Menu (☰) → Import → paste** เนื้อหาใน `node-red/flows.json`
3. กด **Deploy**
4. ดู Dashboard ที่ `http://localhost:1880/ui`

---

## 4. Telegram Bot

1. เปิด Telegram → ค้นหา `@BotFather`
2. พิมพ์ `/newbot` → ตั้งชื่อ → รับ **Bot Token**
3. ส่งข้อความหา bot แล้วเปิด:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. หา `chat_id` จาก response
5. ใส่ทั้งคู่ใน `firmware/main/config.h`

---

## 5. Firmware Upload

```bash
# ใน Arduino IDE
# 1. เปิด firmware/main/main.ino
# 2. แก้ config.h ใส่ WiFi/MQTT/Telegram credentials
# 3. เสียบ ESP32 ผ่าน USB
# 4. เลือก Port ที่ถูกต้อง
# 5. กด Upload (Ctrl+U)
```

---

## 6. MQTT Topics Reference

| Topic | Direction | Format | Description |
|---|---|---|---|
| `home/sensor/climate` | ESP32→ | `{"temp":27.5,"humidity":65.0}` | อุณหภูมิและความชื้น |
| `home/sensor/motion` | ESP32→ | `DETECTED` / `CLEAR` | การเคลื่อนไหว |
| `home/sensor/soil` | ESP32→ | `{"raw":850,"status":"DRY"}` | ความชื้นดิน |
| `home/sensor/energy` | ESP32→ | `{"amps":1.20,"watts":264.0}` | พลังงาน |
| `home/relay/1` | →ESP32 | `ON` / `OFF` / `TOGGLE` | ไฟห้องนอน |
| `home/relay/2` | →ESP32 | `ON` / `OFF` / `TOGGLE` | ไฟห้องนั่งเล่น |
| `home/relay/3` | →ESP32 | `ON` / `OFF` / `TOGGLE` | พัดลม |
| `home/relay/4` | →ESP32 | `ON` / `OFF` / `TOGGLE` | ระบบรดน้ำ |
| `home/status` | ESP32→ | `{"status":"online","ip":"...","uptime":120}` | Heartbeat |
| `home/alert` | ESP32→ | string | การแจ้งเตือนต่างๆ |

---

## 7. Automation Rules

| Rule | เงื่อนไข | Action |
|---|---|---|
| **ไฟอัตโนมัติ** | มีคน AND (มืด OR ค่ำ-เช้า) | เปิดไฟห้องนั่งเล่น, ปิดหลัง 5 นาที |
| **พัดลมอัตโนมัติ** | อุณหภูมิ ≥ 29°C | เปิดพัดลม |
| **พัดลมปิด** | อุณหภูมิ ≤ 24°C | ปิดพัดลม |
| **รดน้ำ** | ดินแห้ง (ADC > 400) | เปิดปั๊ม 30 วินาที |

แก้ค่า threshold ได้ใน `config.h` และแก้ logic ได้ใน `automation.h`

---

## 8. ขยายระบบต่อ

- **OTA Update** — ใช้ `ArduinoOTA` library อัปโหลด firmware ผ่าน WiFi
- **RFID Door Lock** — เพิ่ม `rfid_lock.h` ใช้ MFRC522 + Servo
- **Face Recognition** — ต่อ ESP32-CAM เพิ่มอีกหน่วย
- **Home Assistant** — เปลี่ยน MQTT broker เป็น HA built-in, เพิ่ม auto-discovery
- **Google Home** — เชื่อมผ่าน IFTTT Webhook → MQTT
