# Required Arduino Libraries

Install all libraries via **Arduino IDE → Tools → Manage Libraries**

| Library | Author | Version | Purpose |
|---|---|---|---|
| PubSubClient | Nick O'Leary | ≥2.8 | MQTT client |
| ArduinoJson | Benoit Blanchon | ≥6.21 | JSON encode/decode |
| DHT sensor library | Adafruit | ≥1.4 | DHT22 temperature & humidity |
| Adafruit GFX Library | Adafruit | ≥1.11 | OLED graphics base |
| Adafruit SSD1306 | Adafruit | ≥2.5 | OLED driver |
| NTPClient | Fabrice Weinberg | ≥3.2 | Internet time sync |
| MFRC522 | GithubCommunity | ≥1.4 | RFID RC522 (optional) |

## Board Setup

1. Open Arduino IDE → **Preferences**
2. Add to "Additional Boards Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Board Manager** → search "esp32" → install **esp32 by Espressif**
4. Select: **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
5. Set: Upload Speed `921600`, Flash Size `4MB`
