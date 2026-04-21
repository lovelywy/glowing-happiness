# สูตรทั้งหมดที่ใช้ในเทมเพลต / Formulas Reference

เอกสารนี้รวบรวมสูตรทุกจุดในไฟล์ — วางตาม cell address ที่ระบุไว้
(หลัง import CSV ในชีทใหม่ ให้เปิดชีทนั้นแล้ววางสูตรตรงตาม cell)

> หมายเหตุ: ทุกสูตรใช้ notation ภาษาอังกฤษ (`,` เป็นตัวคั่น) ถ้า locale
> ของคุณเป็นไทย/ยุโรป อาจต้องเปลี่ยน `,` → `;` อัตโนมัติ

---

## ชีท `Settings`

ไม่ต้องใส่สูตร เป็นตารางค่าคงที่ ระบบ Apps Script อ่านผ่านชื่อ key

Named ranges (Data → Named ranges):
- `CALENDAR_YEAR` → `Settings!B2`
- `DATE_START` → `Settings!B4`
- `DATE_END` → `Settings!B5`

---

## ชีท `Categories`

Named range:
- `CAT_IDS` → `Categories!A2:A`
- `CAT_NAMES` → `Categories!B2:B`
- `CAT_TABLE` → `Categories!A2:F`

---

## ชีท `Contacts`

Named range:
- `CON_IDS` → `Contacts!A2:A`
- `CON_NAMES` → `Contacts!B2:B`
- `CON_TABLE` → `Contacts!A2:G`

---

## ชีท `Data`

หัวตาราง (แถว 1) — ตามไฟล์ CSV

### สูตร lookup อัตโนมัติ

**D2 (CategoryName)** — เติม arrayformula ครั้งเดียว:
```
=ARRAYFORMULA(IF(C2:C="","",IFERROR(XLOOKUP(C2:C,CAT_IDS,CAT_NAMES),"⚠ not found")))
```

**F2 (ContactName)**:
```
=ARRAYFORMULA(IF(E2:E="","",IFERROR(XLOOKUP(E2:E,CON_IDS,CON_NAMES),"⚠ not found")))
```

**J2 (Month)**:
```
=ARRAYFORMULA(IF(B2:B="","",TEXT(B2:B,"mmm")))
```

**K2 (Year)**:
```
=ARRAYFORMULA(IF(B2:B="","",YEAR(B2:B)))
```

### Data validation (Data → Data validation)

- Column C (`CategoryID`): dropdown from range `CAT_IDS`
- Column E (`ContactID`): dropdown from range `CON_IDS`
- Column I (`Status`): dropdown list — `Paid,Pending,Overdue,Cancelled`

---

## ชีท `Calendar_Index`

หัวตาราง แถว 1 ตาม CSV — ปี `CALENDAR_YEAR` เปลี่ยนใน Settings ได้

**D2 (StartDate)**:
```
=ARRAYFORMULA(DATE(CALENDAR_YEAR,A2:A13,1))
```

**E2 (EndDate)**:
```
=ARRAYFORMULA(EOMONTH(D2:D13,0))
```

**F2 (Records)**:
```
=ARRAYFORMULA(IF(A2:A13="","",COUNTIFS(Data!B:B,">="&D2:D13,Data!B:B,"<="&E2:E13)))
```

**G2 (Income)**:
```
=ARRAYFORMULA(IF(A2:A13="","",SUMPRODUCT(
  (Data!B2:B>=D2:D13)*(Data!B2:B<=E2:E13)*
  (XLOOKUP(Data!C2:C,Categories!A2:A,Categories!C2:C,"")="Income")*
  (Data!H2:H))))
```

> หากสูตรข้างบนใช้ได้ยากเพราะ arrayformula + SUMPRODUCT ผสมกัน
> ใช้สูตรต่อเซลล์แทน (ตัวอย่าง G2):
```
=SUMIFS(Data!H:H,Data!B:B,">="&D2,Data!B:B,"<="&E2,
        Data!C:C, "C001") + SUMIFS(...)  // ต่อ category ที่เป็น Income
```

**วิธีที่ง่ายกว่า** — ใช้ helper column ใน `Data`:
เพิ่มคอลัมน์ L `Flow` =
```
=ARRAYFORMULA(IF(C2:C="","",XLOOKUP(C2:C,CAT_IDS,Categories!C2:C,"")))
```
จากนั้น G2 ใน Calendar_Index:
```
=SUMIFS(Data!H:H,Data!B:B,">="&D2,Data!B:B,"<="&E2,Data!L:L,"Income")
```

**H2 (Expense)**:
```
=SUMIFS(Data!H:H,Data!B:B,">="&D2,Data!B:B,"<="&E2,Data!L:L,"Expense")
```

**I2 (Net)**:
```
=G2-H2
```

**J2 (Events)** — รวมคำอธิบาย 3 รายการแรก:
```
=TEXTJOIN(" | ", TRUE,
  IFERROR(QUERY(Data!A:K,
    "select G where B >= date '"&TEXT(D2,"yyyy-mm-dd")&
    "' and B <= date '"&TEXT(E2,"yyyy-mm-dd")&"' limit 3",0), ""))
```

---

## ชีท `Search`

โครง (แถว 1 = title, แถว 2 = filter inputs, แถว 4 = results header):

| A2 | B2 | C2 | D2 | E2 | F2 | G2 | H2 | I2 | J2 | K2 |
|----|----|----|----|----|----|----|----|----|----|----|
| Keyword | ⌨ | Category | Dropdown | Contact | Dropdown | Status | Dropdown | DateFrom | date | DateTo |

**D2** dropdown: list `All` + CAT_NAMES
**F2** dropdown: list `All` + CON_NAMES
**H2** dropdown: `All,Paid,Pending,Overdue,Cancelled`

**A5 (ผลลัพธ์ — ใช้ QUERY รวมทุก filter)**:
```
=IFERROR(QUERY(
  {Data!A2:K},
  "select Col1, Col2, Col4, Col6, Col7, Col8, Col9
   where Col1 is not null "
  & IF(B2="", "", " and (lower(Col7) contains lower('"&B2&"') or lower(Col4) contains lower('"&B2&"') or lower(Col6) contains lower('"&B2&"'))")
  & IF(D2="All", "", " and Col4 = '"&D2&"'")
  & IF(F2="All", "", " and Col6 = '"&F2&"'")
  & IF(H2="All", "", " and Col9 = '"&H2&"'")
  & IF(J2="", "", " and Col2 >= date '"&TEXT(J2,"yyyy-mm-dd")&"'")
  & IF(L2="", "", " and Col2 <= date '"&TEXT(L2,"yyyy-mm-dd")&"'")
  & " order by Col2 desc", 0),
"ไม่พบข้อมูล / no match")
```

> Column mapping — Data sheet: A=RecordID, B=Date, D=CategoryName, F=ContactName, G=Description, H=Amount, I=Status

---

## ชีท `Dashboard`

Named range:
- `DASH_START` → `Settings!B4`
- `DASH_END` → `Settings!B5`

### KPIs (top block)

**B3 Total Income**:
```
=SUMIFS(Data!H:H, Data!L:L, "Income", Data!B:B, ">="&DASH_START, Data!B:B, "<="&DASH_END)
```

**B4 Total Expense**:
```
=SUMIFS(Data!H:H, Data!L:L, "Expense", Data!B:B, ">="&DASH_START, Data!B:B, "<="&DASH_END)
```

**B5 Net**: `=B3-B4`

**B6 Records**:
```
=COUNTIFS(Data!B:B, ">="&DASH_START, Data!B:B, "<="&DASH_END)
```

**B7 Top Category**:
```
=IFERROR(INDEX(QUERY(Data!D:H,
  "select D, sum(H) where B >= date '"&TEXT(DASH_START,"yyyy-mm-dd")&
  "' and B <= date '"&TEXT(DASH_END,"yyyy-mm-dd")&
  "' group by D order by sum(H) desc label sum(H) ''",0),2,1), "")
```

**B8 Top Contact**: แทน `D` ด้วย `F`

**F2 Last refreshed**: `=NOW()` (หรือให้ Apps Script เซ็ต timestamp)

### Monthly summary (rows 11..22)

ใช้ `Calendar_Index` เป็น source — ใน B12..E12:
```
B12 =Calendar_Index!G2
C12 =Calendar_Index!H2
D12 =Calendar_Index!I2
E12 =Calendar_Index!F2
```
ลากลงมา 12 แถว

### Top 5 Categories (rows 25..30)

**A26**:
```
=QUERY(Data!D:H,
  "select D, sum(H) where B >= date '"&TEXT(DASH_START,"yyyy-mm-dd")&
  "' and B <= date '"&TEXT(DASH_END,"yyyy-mm-dd")&
  "' group by D order by sum(H) desc limit 5 label sum(H) 'Amount'", 0)
```

### Top 5 Contacts (rows 32..37)

**A33**:
```
=QUERY(Data!F:H,
  "select F, sum(H) where B >= date '"&TEXT(DASH_START,"yyyy-mm-dd")&
  "' and B <= date '"&TEXT(DASH_END,"yyyy-mm-dd")&
  "' group by F order by sum(H) desc limit 5 label sum(H) 'Amount'", 0)
```

### Charts

1. **Monthly Income vs Expense** — เลือกช่วง `A11:D23`, Insert → Chart → Column chart
2. **Category share (Pie)** — เลือกช่วง Top 5 Categories
3. **Net trend (Line)** — เลือก A11:A23 และ D11:D23

---

## Conditional formatting แนะนำ

- `Data!I:I` (Status)
  - `Paid` → green
  - `Pending` → yellow
  - `Overdue` → red
- `Calendar_Index!I:I` (Net) — color scale แดง→เขียว
- `Dashboard!B5` (Net) — ถ้า <0 ตัวอักษรแดง ถ้า >0 สีเขียว
