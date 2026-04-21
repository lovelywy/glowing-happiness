# Round Log — คู่มือติดตั้ง

## 1) สร้างชีท

- เปิด Google Sheet ของพี่ลี่
- สร้างชีทชื่อ **`Round Log`** (ตัวพิมพ์/เว้นวรรคตรงเป๊ะ)
- File → Import → Upload → เลือก `templates/07_RoundLog.csv`
  - Import location: **Replace current sheet**

## 2) ตั้ง format คอลัมน์

| Col | Header | Format | หมายเหตุ |
|-----|--------|--------|--------|
| A | คู่ที่ | Number | auto-fill เมื่อมี Match ID |
| B | Total Back (VND) | Number with thousand separator | |
| C | Total Back (THB) | Number | `=B2/เรทปัจจุบัน` ถ้าอยากให้คำนวณเอง |
| D | Lay Stake | Number | |
| E–I | Line1..Line5 | Text | คลิกขวา → Hide columns |
| J–L | Paid By 1..3 | Text | ใส่ชื่อคนจ่าย |
| M | Remark | Text | **ที่ parser อ่าน** เช่น `T1+1200 T2-500` |
| N | กำไรรวม | Number | สูตรแนะนำ: `=C2-D2` หรือ `=SUM(Q2:<ก่อน Log Time>)` |
| O | ✓ | Checkbox | Insert → Checkbox |
| P | Match ID | Text | เมื่อกรอก A จะ auto-sequence |
| Q+ | T1, T2, … | Number | ระบบสร้างให้เองถ้าชื่อใหม่ |
| last | Log Time | Datetime | ระบบเติมเมื่อทิ๊ก O |

## 3) ติดตั้ง Apps Script

1. Extensions → Apps Script
2. ลบไฟล์ default แล้ววาง 3 ไฟล์
   - `appsscript.json` (ต้องกด ⚙ Project Settings → "Show appsscript.json")
   - `Parser.gs`
   - `RoundLog.gs`
3. Services (+) → เพิ่ม **Drive API v3** (identifier: `Drive`)
4. กด **Save** แล้ว **Deploy > Test deployments** (ไม่จำเป็น แค่ให้ oauth prompt)
5. Reload ชีท → เมนูใหม่ **`Round Log`** จะปรากฏ

## 4) ตั้ง LINE Notify token

1. ไปที่ https://notify-bot.line.me/ → Generate token → เลือกห้องที่จะรับ
2. ในชีท: `Round Log` → **Set LINE token…** → วาง token
3. Token เก็บใน Script Properties (ไม่อยู่ในชีท)

## 5) การใช้งาน

### parse summary จาก Remark อัตโนมัติ
- กรอก Remark ว่า `T1+1200 T2-500` หรือ `ที1 ได้ 1200`
- `onEdit` จะเติมตัวเลขเข้า column T1/T2 ให้เอง
- ถ้าพนักงานชื่อใหม่ (เช่น `T9`) ระบบแทรกคอลัมน์ใหม่ก่อน `Log Time` ให้

### parse จากรูป (OCR)
- อัปโหลดรูปสรุปยอดเข้า Google Drive
- ก๊อป share link
- เมนู `Round Log` → **Apply summary from OCR image URL…** → วาง link
- ระบบ OCR (ภาษาไทย) → parse → เติมตัวเลข

### ปิดคู่ (ทิ๊กเช็คบ็อกซ์)
- ทิ๊ก `✓` คอลัมน์ O
- ระบบจะ:
  1. ล็อกแถว (Protection range) — แก้ไขไม่ได้จนกว่าจะลบ protection
  2. เซ็ต `Log Time` = now
  3. Export แถวเป็น PNG ผ่าน Drive (ได้ public link)
  4. ส่ง LINE: ข้อความสรุป + รูป

## 6) รูปแบบ pattern ที่ parser รองรับ

| Input | Output |
|-------|--------|
| `T1+1200` | `{T1: +1200}` |
| `T3-850` | `{T3: -850}` |
| `T1,T2,T3+1000` | `{T1:+1000, T2:+1000, T3:+1000}` |
| `T1 และ T2 +500` | `{T1:+500, T2:+500}` |
| `ที1 ได้ 1200` | `{T1:+1200}` |
| `ที1 เสีย 800` | `{T1:-800}` |
| `T1 ได้1000 และ T2 เสีย500` | `{T1:+1000, T2:-500}` |
| `ที๑ ได้ ๑๒๐๐` (เลขไทย) | `{T1:+1200}` |
| `T1+1,000 T2-2,500` | `{T1:+1000, T2:-2500}` |

ทดสอบ parser: Apps Script editor → เลือก `testParser` → Run → View Logs

## 7) ข้อจำกัดที่ต้องรู้

- **Screenshot** — Apps Script ไม่มี native screenshot API; ใช้ Sheets export URL แทน.
  ผลลัพธ์อาจจัดหน้ากว้างเกินถ้าคอลัมน์เยอะ — ถ้าพี่ลี่อยากได้การ์ดสวย ๆ
  เปลี่ยนไปใช้ HTML template → render ผ่าน Charts/Apps Script HTMLService
- **LINE Notify** — กำลังถูก LINE announce deprecation; ถ้าพี่ลี่เปิดใช้ไม่ได้
  ผมเปลี่ยนเป็น Messaging API ได้ (broadcast/push ด้วย channel access token)
- **Row lock** — ใช้ `Protection.removeEditors(...)`; editor ที่เป็น owner
  จะ override ได้ — ถ้าต้องการ hard lock ต้องย้าย sheet ไปเป็น view-only
  สำหรับ user อื่น
- **onEdit** — simple trigger ไม่มี permission เรียก UrlFetch/Drive; ถ้าเจอ error
  ต้องสร้าง installable trigger: Apps Script → Triggers → Add → `onEdit` function,
  event type: On edit
