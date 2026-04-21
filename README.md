# Google Sheet Template — Dashboard + Calendar + Search

เทมเพลต Google Sheet แบบครบชุด สำหรับจัดการข้อมูล มีระบบเชื่อมโยงข้อมูล (relational),
การค้นหา/กรอง, แดชบอร์ดแสดงผลแบบเรียลไทม์ และปฏิทินรายเดือน 12 เดือน

A complete Google Sheet template with linked data, search/filter,
real‑time dashboard, and a 12‑month calendar index.

## โครงสร้าง / Structure

```
.
├── README.md                       # เอกสารหลัก / main doc
├── docs/
│   ├── setup-guide.md              # วิธีติดตั้งทีละขั้น / step-by-step setup
│   ├── formulas.md                 # สูตรทั้งหมดที่ใช้ / all formulas used
│   └── data-model.md               # โครงสร้างข้อมูลและความสัมพันธ์ / data model
├── templates/                      # CSV สำหรับ import แต่ละชีท / CSV per tab
│   ├── 00_Settings.csv
│   ├── 01_Categories.csv
│   ├── 02_Contacts.csv
│   ├── 03_Data.csv
│   ├── 04_Calendar_Index.csv
│   ├── 05_Search.csv
│   └── 06_Dashboard.csv
└── apps-script/                    # Google Apps Script
    ├── Code.gs                     # main logic (search, menu, validation)
    ├── Calendar.gs                 # 12-month calendar generator
    ├── Dashboard.gs                # dashboard refresh helpers
    └── appsscript.json             # manifest
```

## ชีท (Tabs) ทั้งหมด

| # | ชีท | หน้าที่ |
|---|-----|--------|
| 0 | **Settings** | ตั้งค่ากลาง: ปีของปฏิทิน, สกุลเงิน, ช่วงวันที่ |
| 1 | **Categories** | ตารางอ้างอิงหมวดหมู่ (lookup table) |
| 2 | **Contacts** | ตารางอ้างอิงผู้ติดต่อ / ลูกค้า |
| 3 | **Data** | ตารางข้อมูลหลัก (transactions / records) |
| 4 | **Calendar_Index** | ปฏิทิน 12 เดือน พร้อม event จาก Data |
| 5 | **Search** | หน้าค้นหาแบบ interactive |
| 6 | **Dashboard** | KPI, กราฟ, สรุปผล |

## เริ่มใช้งานเร็ว / Quick Start

1. สร้าง Google Sheet ใหม่
2. เปิด `docs/setup-guide.md` แล้วทำตามขั้นตอน
3. Import แต่ละไฟล์ใน `templates/` เป็นชีทใหม่ (File → Import → Upload → Insert new sheet)
4. เปิด Extensions → Apps Script แล้ววางโค้ดจาก `apps-script/`
5. รีเฟรชหน้าชีท เมนูใหม่ **"Template Tools"** จะปรากฏ

## คุณสมบัติหลัก / Features

- **Data linking** — ชีท `Data` ดึงชื่อ Category/Contact จาก lookup ผ่าน `XLOOKUP` อัตโนมัติ
- **Search** — พิมพ์คำในชีท `Search` ระบบใช้ `QUERY` คืนผลลัพธ์หลายคอลัมน์
- **Dashboard** — KPI (ยอดรวม, จำนวนรายการ, top category), กราฟ, สรุปรายเดือน
- **12-month Calendar** — เลือกปีได้ใน `Settings`, ระบบ generate ปฏิทินและ overlay event
- **Data validation** — dropdown ของ Category/Contact ใช้ named range อัตโนมัติ
- **Menu `Template Tools`** — Refresh dashboard, Generate calendar, Clear search, Add new row
