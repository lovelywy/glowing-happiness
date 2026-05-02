"""
Home Automation — Python Controller
────────────────────────────────────
ทำหน้าที่เป็น middleware ระหว่าง Arduino (MQTT) กับ ผู้ใช้ / ระบบอื่น

คุณสมบัติ:
  • Subscribe MQTT รับ sensor / relay status จาก Arduino
  • ส่งคำสั่งควบคุม relay ผ่าน MQTT
  • บันทึก log ลง CSV (sensor_log.csv)
  • Simple CLI สำหรับควบคุมแบบ interactive
  • รองรับ schedule task (เปิด/ปิดอัตโนมัติตามเวลา)

ติดตั้ง dependency:
  pip install paho-mqtt schedule

รันโปรแกรม:
  python controller.py
"""

import json
import csv
import os
import time
import threading
import schedule
import paho.mqtt.client as mqtt
from datetime import datetime

# ─── Config ──────────────────────────────────────────────────────────────────
MQTT_HOST      = "192.168.1.100"
MQTT_PORT      = 1883
MQTT_USER      = ""
MQTT_PASSWORD  = ""
TOPIC_ROOT     = "home/arduino01"
LOG_FILE       = "sensor_log.csv"

RELAY_NAMES = {
    0: "ไฟห้องนั่งเล่น",
    1: "ไฟห้องนอน",
    2: "พัดลมห้องนั่งเล่น",
    3: "เต้าเสียบห้องครัว",
}

# ─── State cache ─────────────────────────────────────────────────────────────
relay_states  = {}
sensor_data   = {}

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
def init_log():
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(
                ["timestamp", "temperature", "humidity", "motion", "light"]
            )

def log_sensor(data: dict):
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([
            datetime.now().isoformat(),
            data.get("temperature", ""),
            data.get("humidity", ""),
            data.get("motion", ""),
            data.get("light", ""),
        ])

# ─────────────────────────────────────────────────────────────────────────────
# MQTT callbacks
# ─────────────────────────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] เชื่อมต่อ broker สำเร็จ ({MQTT_HOST}:{MQTT_PORT})")
        client.subscribe(f"{TOPIC_ROOT}/sensor")
        client.subscribe(f"{TOPIC_ROOT}/relay")
        client.subscribe(f"{TOPIC_ROOT}/status")
    else:
        print(f"[MQTT] เชื่อมต่อล้มเหลว rc={rc}")

def on_disconnect(client, userdata, rc):
    print(f"[MQTT] ขาดการเชื่อมต่อ rc={rc} — กำลังเชื่อมต่อใหม่…")

def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode("utf-8", errors="ignore")

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return

    if topic.endswith("/sensor"):
        sensor_data.update(data)
        log_sensor(data)
        print(
            f"[Sensor] {datetime.now().strftime('%H:%M:%S')} "
            f"temp={data.get('temperature','?')}°C  "
            f"hum={data.get('humidity','?')}%  "
            f"motion={'YES' if data.get('motion') else 'no'}  "
            f"light={data.get('light','?')}"
        )

    elif topic.endswith("/relay"):
        relay_states.update(data)
        states = "  ".join(f"{k}={v}" for k, v in data.items())
        print(f"[Relay] {states}")

    elif topic.endswith("/status"):
        ip = data.get("ip", "?")
        rssi = data.get("rssi", "?")
        uptime = data.get("uptime", 0)
        print(f"[Status] IP={ip}  RSSI={rssi}dBm  uptime={uptime}s")

# ─────────────────────────────────────────────────────────────────────────────
# Command helpers
# ─────────────────────────────────────────────────────────────────────────────
_client: mqtt.Client = None

def relay_set(relay_id: int, state: str):
    """state: 'ON' | 'OFF' | 'TOGGLE'"""
    if _client is None:
        print("[ERROR] ยังไม่ได้เชื่อมต่อ MQTT")
        return
    topic   = f"{TOPIC_ROOT}/cmd/relay/{relay_id}"
    payload = json.dumps({"state": state.upper()})
    _client.publish(topic, payload)
    print(f"[CMD] relay/{relay_id} → {state}")

def all_off():
    if _client is None:
        return
    _client.publish(f"{TOPIC_ROOT}/cmd/all", json.dumps({"state": "OFF"}))
    print("[CMD] ปิดทุก relay")

def show_status():
    print("\n─── Relay ───────────────────────────────")
    for i, name in RELAY_NAMES.items():
        key   = list(relay_states.keys())[i] if i < len(relay_states) else "?"
        state = relay_states.get(key, "?")
        print(f"  [{i}] {name:20s} : {state}")
    print("─── Sensor ──────────────────────────────")
    print(f"  อุณหภูมิ  : {sensor_data.get('temperature','?')} °C")
    print(f"  ความชื้น  : {sensor_data.get('humidity','?')} %")
    print(f"  การเคลื่อน: {'ตรวจพบ' if sensor_data.get('motion') else 'ไม่มี'}")
    print(f"  แสงสว่าง  : {sensor_data.get('light','?')}")
    print("─────────────────────────────────────────\n")

# ─────────────────────────────────────────────────────────────────────────────
# Scheduled tasks ตัวอย่าง
# ─────────────────────────────────────────────────────────────────────────────
def schedule_tasks():
    schedule.every().day.at("18:00").do(lambda: relay_set(0, "ON"))   # เปิดไฟห้องนั่งเล่น 18:00
    schedule.every().day.at("23:00").do(lambda: relay_set(0, "OFF"))  # ปิดไฟ 23:00
    schedule.every().day.at("23:30").do(all_off)                      # ปิดทุกอย่าง 23:30

def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(30)

# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
HELP = """
คำสั่งที่ใช้ได้:
  on  <id>   — เปิด relay ตาม id (0-3)
  off <id>   — ปิด relay ตาม id
  tog <id>   — toggle relay ตาม id
  all off    — ปิดทุก relay
  status     — แสดงสถานะปัจจุบัน
  help       — แสดงความช่วยเหลือ
  quit       — ออกจากโปรแกรม
"""

def cli_loop():
    print(HELP)
    while True:
        try:
            line = input("home> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nออกจากโปรแกรม")
            break

        parts = line.split()
        if not parts:
            continue

        cmd = parts[0]

        if cmd == "quit":
            os._exit(0)
        elif cmd == "help":
            print(HELP)
        elif cmd == "status":
            show_status()
        elif cmd in ("on", "off", "tog") and len(parts) >= 2:
            try:
                rid   = int(parts[1])
                state = {"on": "ON", "off": "OFF", "tog": "TOGGLE"}[cmd]
                relay_set(rid, state)
            except (ValueError, KeyError):
                print("รูปแบบคำสั่งไม่ถูกต้อง")
        elif cmd == "all" and len(parts) >= 2 and parts[1] == "off":
            all_off()
        else:
            print("ไม่รู้จักคำสั่ง พิมพ์ help เพื่อดูคำสั่งทั้งหมด")

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    global _client

    init_log()

    client = mqtt.Client()
    _client = client

    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_message    = on_message

    client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    schedule_tasks()
    threading.Thread(target=run_scheduler, daemon=True).start()

    cli_loop()

    client.loop_stop()
    client.disconnect()

if __name__ == "__main__":
    main()
