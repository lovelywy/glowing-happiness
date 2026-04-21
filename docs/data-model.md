# Data Model — ความสัมพันธ์ระหว่างชีท

```
┌───────────────┐        ┌────────────────┐        ┌───────────────┐
│  Categories   │        │     Data       │        │   Contacts    │
│───────────────│        │────────────────│        │───────────────│
│ CategoryID PK │◄───────┤ CategoryID FK  │───────►│ ContactID PK  │
│ CategoryName  │  1..N  │ ContactID  FK  │  N..1  │ Name          │
│ Type          │        │ Date           │        │ Email         │
│ Budget        │        │ Amount         │        │ Phone         │
│ Color         │        │ Description    │        │ Company       │
└───────────────┘        │ Status         │        └───────────────┘
                         └────────┬───────┘
                                  │
                 ┌────────────────┼───────────────┐
                 ▼                                ▼
         ┌───────────────┐                ┌───────────────┐
         │ Calendar_Index│                │   Dashboard   │
         │───────────────│                │───────────────│
         │ Month 1..12   │                │ KPIs          │
         │ Sum(Income)   │                │ Monthly roll  │
         │ Sum(Expense)  │                │ Top 5 Cat/Con │
         │ Events text   │                │ Charts        │
         └───────────────┘                └───────────────┘
                 ▲                                ▲
                 └──────── Settings ──────────────┘
                       (CalendarYear,
                        DateStart, DateEnd)
```

## คีย์และความสัมพันธ์

| From                   | Field         | To          | Field      | Type    |
|------------------------|---------------|-------------|------------|---------|
| Data.CategoryID        | FK            | Categories  | CategoryID | N..1    |
| Data.ContactID         | FK            | Contacts    | ContactID  | N..1    |
| Calendar_Index.Month   | date range    | Data        | Date       | 1..N    |
| Dashboard KPIs         | date range    | Data        | Date+Type  | 1..N    |

## กฎ (invariants)

1. `CategoryID` ต้องเริ่มด้วย `C` + 3 หลัก (C001, C002, …)
2. `ContactID` ต้องเริ่มด้วย `P` + 3 หลัก
3. `RecordID` ต้องเริ่มด้วย `R` + 4 หลัก
4. ทุกแถวใน `Data` ต้องมี `Date`, `CategoryID`, `Amount` อย่างน้อย
5. `Categories.Type` ต้องเป็น `Income` หรือ `Expense` เท่านั้น
6. `Status` ใน `Data` ต้องอยู่ในเซ็ต {Paid, Pending, Overdue, Cancelled}

## Named ranges ที่ต้องสร้าง

| ชื่อ              | ช่วง                      | ใช้ใน                   |
|-------------------|---------------------------|-------------------------|
| CALENDAR_YEAR     | `Settings!B2`             | Calendar_Index          |
| DATE_START        | `Settings!B4`             | Dashboard KPIs          |
| DATE_END          | `Settings!B5`             | Dashboard KPIs          |
| DASH_START        | `Settings!B4`             | Dashboard (alias)       |
| DASH_END          | `Settings!B5`             | Dashboard (alias)       |
| CAT_IDS           | `Categories!A2:A`         | Data validation, lookup |
| CAT_NAMES         | `Categories!B2:B`         | Data lookup             |
| CAT_TABLE         | `Categories!A2:F`         | Advanced lookup         |
| CON_IDS           | `Contacts!A2:A`           | Data validation, lookup |
| CON_NAMES         | `Contacts!B2:B`           | Data lookup             |
| CON_TABLE         | `Contacts!A2:G`           | Advanced lookup         |
