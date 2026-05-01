# Round Log — วิธีติดตั้ง (3 ขั้น)

## ขั้น 1 — สร้างชีทเปล่า

1. เปิด https://sheets.google.com → กด **+ Blank**
2. ตั้งชื่อไฟล์ (ชื่ออะไรก็ได้)

## ขั้น 2 — วางโค้ด

1. เมนู **Extensions → Apps Script**
2. ลบ `Code.gs` ทิ้ง
3. สร้างไฟล์ 3 ตัว แล้วก๊อปโค้ดมาวาง
   - `Parser.gs` ← `apps-script/Parser.gs`
   - `RoundLog.gs` ← `apps-script/RoundLog.gs`
   - `Setup.gs` ← `apps-script/Setup.gs`
4. ⚙ **Project Settings** → ติ๊ก **"Show appsscript.json"**
5. เปิด `appsscript.json` ลบทิ้ง → ก๊อป `apps-script/appsscript.json` มาวาง
6. แถบซ้าย → **Services** (+) → **Drive API** → Add
7. กด 💾 **Save**

## ขั้น 3 — ติดตั้งอัตโนมัติ

1. กลับมาที่ชีท → **รีเฟรชหน้า (F5)**
2. เมนูใหม่ **Round Log** โผล่ด้านบน
3. กด **🚀 Install / Reset all sheets**
4. Google จะขอสิทธิ์ครั้งแรก → Allow (ถ้าเตือน "Google hasn't verified" → Advanced → Go to project → Allow)
5. รอ 3–5 วินาที ระบบสร้าง 4 ชีทให้เอง:
   - **Round Log** — บันทึกข้อมูล
   - **Dashboard** — KPI + สรุปรายพนักงาน + กำไรรายวัน
   - **Calendar** — 12 เดือน
   - **Search** — ค้นหา filter ได้
6. (ไม่บังคับ) เมนู `Round Log → 📊 Refresh charts` เพื่อสร้างกราฟใน Dashboard

---

## การใช้งาน

### บันทึกคู่ใหม่
1. ไปชีท **Round Log** แถวถัดไป
2. กรอก Total Back, Lay Stake, Paid By, **Match ID**
   - เมื่อกรอก Match ID → `คู่ที่` กับ `Log Time` เติมให้เอง
3. กรอก **Remark** ว่าใครได้/เสียเท่าไหร่ เช่น `T1+1200 T2-500`
   - ระบบ parse แล้วเติมลงคอลัมน์ T1, T2 ให้เอง
   - ถ้าชื่อใหม่ (เช่น T9) → สร้างคอลัมน์ใหม่ก่อน Log Time ให้เอง
   - `กำไรรวม` (N) เติมให้เอง = ผลรวม T*

### ปิดคู่
- ทิ๊ก ✓ คอลัมน์ O
- ระบบ: ล็อกแถว + export PNG + ส่ง LINE (ถ้าตั้ง token)

### ตั้ง LINE (ไม่บังคับ)
1. https://notify-bot.line.me/my/ → Generate token
2. เมนู `Round Log` → **Set LINE token…** → วาง

### OCR จากรูป
1. อัปรูปสรุปยอดเข้า Drive → ก๊อป share link
2. เมนู `Round Log` → **Apply summary from OCR image URL…**

### ค้นหาข้อมูล
ไปที่ชีท **Search** กรอกได้ทุก filter รวมกัน:
- คำค้น (เจอใน Remark หรือ Match ID)
- พนักงาน (เช่น `T1`)
- ช่วงวันที่
- เฉพาะคู่ที่ปิดแล้ว ✓

ลบค่าใน filter เพื่อ reset

### ทดสอบด้วยข้อมูลตัวอย่าง
เมนู `Round Log → 🧪 Test → Insert 5 sample rows` — เติม 5 แถวตัวอย่างให้ทดสอบ
จะเห็นผลที่ Dashboard / Calendar / Search ทันที

ล้างทิ้ง: `Round Log → 🧪 Test → Clear all data`

---

## Pattern ที่ parser รองรับ

| Input | ผลลัพธ์ |
|-------|---------|
| `T1+1200` | T1: +1200 |
| `T3-850` | T3: -850 |
| `T1,T2,T3+1000` | ทั้ง 3 คน +1000 |
| `T1 และ T2 +500` | ทั้ง 2 คน +500 |
| `ที1 ได้ 1200` | T1: +1200 |
| `ที1 เสีย 800` | T1: -800 |
| `T1 ได้1000 และ T2 เสีย500` | T1: +1000, T2: -500 |
| `ที๑ ได้ ๑๒๐๐` (เลขไทย) | T1: +1200 |
| `T1+1,000 T2-2,500` (มี comma) | T1: +1000, T2: -2500 |

---

## ปัญหาที่เจอบ่อย

| อาการ | วิธีแก้ |
|-------|--------|
| ไม่เห็นเมนู Round Log | รีเฟรชหน้าชีท (F5) |
| กดเมนูแล้วไม่มีอะไรเกิดขึ้น | Google กำลังขอสิทธิ์ครั้งแรก รออนุญาตก่อน |
| Dashboard / Calendar ขึ้น #ERROR! | ยังไม่มีข้อมูลใน Round Log, ปกติ |
| LINE ส่งไม่เข้า | เช็ก token ที่ `Round Log → Set LINE token…` |
| parser ไม่ทำงาน | เช็กว่าเขียน T ตามด้วยเลข (T1, T2) ไม่ใช่ชื่อจริง |

---

## ข้อจำกัด (สำหรับอนาคต)

- **LINE Notify** กำลังถูก deprecate — ถ้าปิดบริการจะต้องย้ายไป Messaging API
- **Screenshot** ใช้ Sheets export PNG — ถ้าแถวกว้างมาก รูปอาจเล็ก
- **Row lock** เป็น Sheet Protection — owner ของไฟล์ยัง override ได้
