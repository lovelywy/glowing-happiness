/**
 * Code.combined.gs — ไฟล์เดียวจบ
 * รวม Parser + RoundLog + Setup ไว้สำหรับมือใหม่
 *
 * วิธีใช้: ก๊อปไฟล์นี้ทั้งหมด → วางใน Code.gs ของ Apps Script → Save
 *         → กลับมาที่ชีท → รีเฟรช → เมนู Round Log → 🚀 Install / Reset all sheets
 */

/**
 * Parser.gs — แปลงข้อความสรุปยอดเป็นคู่ {employee: amount}
 *
 * รองรับรูปแบบ:
 *   "T1+1200"                       → { T1: +1200 }
 *   "T3-850"                        → { T3:  -850 }
 *   "T1,T2,T3+1000"                 → { T1: +1000, T2: +1000, T3: +1000 }  (ทุกคนได้คนละ 1000)
 *   "ที1 ได้ 1200"                   → { T1: +1200 }
 *   "ที1 เสีย 800"                   → { T1:  -800 }
 *   "t1 +200  t2 -150"              → { T1: +200, T2: -150 }
 *   "T1 ได้1000 และ T2 เสีย500"      → { T1: +1000, T2:  -500 }
 *   หลายบรรทัดในสตริงเดียวกัน         → รวมผลทั้งหมด
 *
 * การ normalize:
 *   ที          → T
 *   ได้/รับ/+    → +
 *   เสีย/จ่าย/-  → -
 *   ตัวเลขไทย ๐-๙ → 0-9
 */

const THAI_DIGIT_MAP = { '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9' };

function normalizeText_(raw) {
  if (raw == null) return '';
  let s = String(raw);
  // thai digits → arabic
  s = s.replace(/[๐-๙]/g, d => THAI_DIGIT_MAP[d] || d);
  // thai "ที<digit>" → "T<digit>" (with optional space)
  s = s.replace(/ที\s*(\d+)/gi, 'T$1');
  // thai verbs → operators
  s = s.replace(/ได้|รับ|บวก/g, '+');
  s = s.replace(/เสีย|จ่าย|ลบ|ติด/g, '-');
  // unify whitespace
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

/**
 * parseSummary("T1,T2+500 T3-200") → [{names:['T1','T2'], amount:500}, {names:['T3'], amount:-200}]
 * Returns array of {names, amount} groups; order preserved.
 */
function parseSummary(raw) {
  const text = normalizeText_(raw);
  const results = [];
  // match: one or more "Txx" names separated by comma or "และ"/"and"
  //        followed by optional spaces, +/-, optional spaces, integer (may have comma thousands)
  const re = /(T\d+(?:\s*(?:,|และ|and|\+และ)\s*T\d+)*)\s*([+\-])\s*([\d,]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const names = m[1].match(/T\d+/gi).map(n => n.toUpperCase());
    const sign = m[2] === '-' ? -1 : 1;
    const amount = sign * Number(m[3].replace(/,/g, ''));
    if (!isFinite(amount)) continue;
    results.push({ names, amount });
  }
  return results;
}

/**
 * Flatten parser output into { T1: 200, T2: -100 } summed per employee.
 */
function flattenSummary(groups) {
  const out = {};
  for (const g of groups) {
    for (const name of g.names) {
      out[name] = (out[name] || 0) + g.amount;
    }
  }
  return out;
}

/**
 * Self-test — run from Apps Script editor.
 * View → Logs to see output.
 */
function testParser() {
  const cases = [
    ['T1+1200',                { T1: 1200 }],
    ['T3-850',                 { T3: -850 }],
    ['T1,T2,T3+1000',          { T1: 1000, T2: 1000, T3: 1000 }],
    ['ที1 ได้ 1200',            { T1: 1200 }],
    ['ที1 เสีย 800',            { T1: -800 }],
    ['T1 ได้1000 และ T2 เสีย500', { T1: 1000, T2: -500 }],
    ['t1+200 t2-150',          { T1: 200, T2: -150 }],
    ['T1+1,000 T2-2,500',      { T1: 1000, T2: -2500 }],
    ['ที๑ ได้ ๑๒๐๐',            { T1: 1200 }],
  ];
  let pass = 0, fail = 0;
  cases.forEach(([input, expected]) => {
    const got = flattenSummary(parseSummary(input));
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    Logger.log((ok ? 'PASS' : 'FAIL') + ' | ' + input + ' → ' + JSON.stringify(got));
    ok ? pass++ : fail++;
  });
  Logger.log('Result: ' + pass + ' pass / ' + fail + ' fail');
}
/**
 * RoundLog.gs — logic หลักของชีท Round Log
 *
 * คอลัมน์หลัก (ref):
 *   A   คู่ที่ (auto sequence)
 *   B   Total Back (VND)
 *   C   Total Back (THB)
 *   D   Lay Stake
 *   E-I Line1..Line5 (hidden)
 *   J-L Paid By 1..3
 *   M   Remark
 *   N   กำไรรวม
 *   O   Checkbox (เมื่อติ๊ก → lock + cap + ส่ง LINE)
 *   P   Match ID
 *   Q.. T1, T2, ... Tn (employee columns)
 *   last Log Time
 */

const SHEET_NAME = 'Round Log';
const LOG_TIME_HEADER = 'Log Time';
const CHECKBOX_COL = 15;  // O
const MATCH_ID_COL = 16;  // P
const PROFIT_COL   = 14;  // N
const REMARK_COL   = 13;  // M
const PAIR_NO_COL  = 1;   // A

// ───────────────────────────────────────────── menu

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Round Log')
    .addItem('🚀 Install / Reset all sheets', 'installAll')
    .addItem('📊 Refresh charts',             'refreshCharts')
    .addSeparator()
    .addItem('Apply summary from Remark (current row)', 'applySummaryFromCurrentRow')
    .addItem('Apply summary from OCR image URL...',     'promptApplyFromImage')
    .addItem('Send current row to LINE',                'sendCurrentRowToLine')
    .addItem('Recalculate profit (current row)',        'recalcProfitCurrentRow')
    .addItem('Run parser self-test',                    'testParser')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Test')
      .addItem('Insert 5 sample rows', 'insertSampleData')
      .addItem('Clear all data',        'clearAllData'))
    .addItem('Set LINE token...',                       'promptSetLineToken')
    .addToUi();
}

function recalcProfitCurrentRow() {
  const row = sheet_().getActiveRange().getRow();
  if (row < 2) { toast_('ต้องอยู่ที่แถวข้อมูล'); return; }
  recalcProfit_(row);
  toast_('คำนวณกำไรรวมใหม่แล้ว');
}

// ───────────────────────────────────────────── core

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
}

function headerRow_() {
  const sh = sheet_();
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function findLogTimeCol_() {
  const h = headerRow_();
  for (let i = 0; i < h.length; i++) {
    if (String(h[i]).trim() === LOG_TIME_HEADER) return i + 1;
  }
  return h.length;  // fallback: last column
}

/**
 * หา column index ของพนักงาน; ถ้าไม่มี → แทรกคอลัมน์ใหม่ก่อน Log Time
 */
function ensureEmployeeColumn_(name) {
  const sh = sheet_();
  const h = headerRow_();
  const upper = name.toUpperCase();
  for (let i = 0; i < h.length; i++) {
    if (String(h[i]).trim().toUpperCase() === upper) return i + 1;
  }
  const logCol = findLogTimeCol_();
  sh.insertColumnBefore(logCol);
  sh.getRange(1, logCol).setValue(upper).setFontWeight('bold');
  return logCol;
}

/**
 * เขียนค่าจาก summary ลงในแถวที่ระบุ (row = 1-based)
 */
function applySummaryToRow_(row, flat) {
  const sh = sheet_();
  Object.keys(flat).forEach(name => {
    const col = ensureEmployeeColumn_(name);
    const cell = sh.getRange(row, col);
    const prev = Number(cell.getValue()) || 0;
    cell.setValue(prev + flat[name]);
  });
}

/**
 * คำนวณ N (กำไรรวม) = ผลรวมคอลัมน์ T* ของแถวนั้น
 * (ระหว่าง Match ID+1 ถึง Log Time-1)
 */
function recalcProfit_(row) {
  const sh = sheet_();
  const logCol = findLogTimeCol_();
  const empStart = MATCH_ID_COL + 1;
  if (logCol <= empStart) return;
  const vals = sh.getRange(row, empStart, 1, logCol - empStart).getValues()[0];
  const total = vals.reduce((s, v) => s + (Number(v) || 0), 0);
  sh.getRange(row, PROFIT_COL).setValue(total);
}

function applySummaryFromCurrentRow() {
  const sh = sheet_();
  const row = sh.getActiveRange().getRow();
  if (row < 2) { toast_('ต้องอยู่ที่แถวข้อมูล (row >= 2)'); return; }
  const remark = sh.getRange(row, REMARK_COL).getValue();
  const flat = flattenSummary(parseSummary(remark));
  if (!Object.keys(flat).length) { toast_('ไม่พบ pattern ใน Remark'); return; }
  applySummaryToRow_(row, flat);
  recalcProfit_(row);
  toast_('อัปเดต: ' + JSON.stringify(flat));
}

// ───────────────────────────────────────────── onEdit → ติ๊กเช็คบ็อกซ์

/**
 * handleEdit: เรียกจาก installable trigger เท่านั้น (ดู Setup.gs)
 * ไม่ตั้งชื่อเป็น onEdit เพื่อกัน simple trigger ยิงซ้ำ
 * (simple trigger + installable trigger จะทำให้ parse บวกเลขสองครั้ง)
 */
function handleEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== SHEET_NAME) return;
    const row = e.range.getRow();
    const col = e.range.getColumn();
    if (row < 2) return;

    // auto-sequence คอลัมน์ A + ตั้ง Log Time เมื่อกรอก Match ID
    if (col === MATCH_ID_COL && e.value) {
      const pairCell = sh.getRange(row, PAIR_NO_COL);
      if (!pairCell.getValue()) pairCell.setValue(row - 1);
      const logCol = findLogTimeCol_();
      const logCell = sh.getRange(row, logCol);
      if (!logCell.getValue()) logCell.setValue(new Date());
    }

    // apply parser อัตโนมัติเมื่อแก้ Remark
    if (col === REMARK_COL && e.value) {
      const flat = flattenSummary(parseSummary(e.value));
      if (Object.keys(flat).length) {
        applySummaryToRow_(row, flat);
        recalcProfit_(row);
      }
    }

    // ติ๊กเช็คบ็อกซ์ → lock + ส่ง LINE
    if (col === CHECKBOX_COL && e.value === 'TRUE') {
      finalizeRow_(row);
    }
  } catch (err) {
    console.error('handleEdit failed: ' + err.stack);
  }
}

function finalizeRow_(row) {
  const sh = sheet_();
  const lastCol = sh.getLastColumn();
  const rng = sh.getRange(row, 1, 1, lastCol);

  // 1) lock row
  const protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const alreadyLocked = protections.some(p => p.getRange().getRow() === row);
  if (!alreadyLocked) {
    const p = rng.protect().setDescription('Locked after checkbox ' + new Date().toISOString());
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  }

  // 2) set log time (คอลัมน์สุดท้าย) ถ้าว่าง
  const logCol = findLogTimeCol_();
  const logCell = sh.getRange(row, logCol);
  if (!logCell.getValue()) logCell.setValue(new Date());

  // 3) ส่ง LINE
  try {
    sendRowToLine_(row);
  } catch (err) {
    toast_('LINE ส่งไม่สำเร็จ: ' + err.message);
  }
}

function sendCurrentRowToLine() {
  const row = sheet_().getActiveRange().getRow();
  if (row < 2) { toast_('ต้องอยู่ที่แถวข้อมูล'); return; }
  sendRowToLine_(row);
}

// ───────────────────────────────────────────── LINE

function sendRowToLine_(row) {
  const sh = sheet_();
  const lastCol = sh.getLastColumn();
  const header = headerRow_();
  const values = sh.getRange(row, 1, 1, lastCol).getValues()[0];

  const getByHeader = name => {
    const i = header.findIndex(h => String(h).trim() === name);
    return i >= 0 ? values[i] : '';
  };

  // รวบรวม summary per employee (คอลัมน์ระหว่าง P+1 ถึง Log Time-1)
  const logCol = findLogTimeCol_();
  const empStart = MATCH_ID_COL + 1;
  const parts = [];
  for (let c = empStart; c < logCol; c++) {
    const v = Number(values[c - 1]);
    if (v) parts.push(`${header[c - 1]} ${v > 0 ? '+' : ''}${v}`);
  }

  const scenario = getByHeader('Remark') || '(no remark)';
  const profit   = getByHeader('กำไรรวม') || 0;
  const matchId  = getByHeader('Match ID') || ('row ' + row);
  const pair     = getByHeader('คู่ที่') || row - 1;

  const board = [
    '📋 Round Log — คู่ที่ ' + pair,
    'Match: ' + matchId,
    'Scenario: ' + scenario,
    'สรุปรายคน: ' + (parts.join(', ') || '—'),
    'กำไรรวม: ' + profit,
  ].join('\n');

  const token = PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_TOKEN');
  if (!token) {
    toast_('ยังไม่ได้ตั้ง LINE_NOTIFY_TOKEN — เมนู Round Log → Set LINE token');
    return;
  }

  // แนบรูป: export row เป็น PNG (ดู captureRowAsPng_)
  let imageUrl = null;
  try {
    imageUrl = captureRowAsPng_(row);
  } catch (err) {
    console.warn('capture skipped: ' + err.message);
  }

  const payload = { message: '\n' + board };
  if (imageUrl) {
    payload.imageThumbnail = imageUrl;
    payload.imageFullsize  = imageUrl;
  }

  UrlFetchApp.fetch('https://notify-api.line.me/api/notify', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true,
  });
}

function promptSetLineToken() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('LINE Notify token', 'วาง token:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('LINE_NOTIFY_TOKEN', res.getResponseText().trim());
    toast_('บันทึก token แล้ว');
  }
}

// ───────────────────────────────────────────── capture row → PNG

/**
 * export ช่วงแถวเดียวเป็นรูป PNG แล้วคืน public URL จาก Google Drive
 * ใช้ Drive API สร้างไฟล์ shareable-by-link
 *
 * NOTE: Apps Script ไม่มี native screenshot — เทคนิคนี้ใช้ Sheets export URL
 * แล้วบันทึกผ่าน Drive. ถ้าผลลัพธ์ไม่สวย แนะนำใช้ HTML card template แทน
 */
function captureRowAsPng_(row) {
  const ss = SpreadsheetApp.getActive();
  const sh = sheet_();
  const lastCol = sh.getLastColumn();
  const gid = sh.getSheetId();

  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() +
    '/export?format=png&gid=' + gid +
    '&range=' + sh.getRange(row, 1, 1, lastCol).getA1Notation() +
    '&portrait=false&fitw=true&gridlines=true';

  const blob = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  }).getBlob().setName('roundlog-row-' + row + '-' + Date.now() + '.png');

  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // LINE Notify ต้องการ direct image URL (Drive web-view ใช้ไม่ได้ทันที)
  const id = file.getId();
  return 'https://drive.google.com/uc?export=view&id=' + id;
}

// ───────────────────────────────────────────── OCR (จากรูปใน Drive)

function promptApplyFromImage() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Drive file ID หรือ URL ของรูปสรุปยอด',
    'วาง file id หรือ share URL:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const id = extractDriveId_(res.getResponseText());
  if (!id) { toast_('หา file id ไม่เจอ'); return; }
  const text = ocrDriveImage_(id);
  toast_('OCR: ' + text.slice(0, 120));
  const flat = flattenSummary(parseSummary(text));
  if (!Object.keys(flat).length) { toast_('parser ไม่เจอ pattern'); return; }
  const row = sheet_().getActiveRange().getRow();
  applySummaryToRow_(row, flat);
  recalcProfit_(row);
}

function extractDriveId_(s) {
  if (!s) return null;
  s = s.trim();
  const m = s.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

function ocrDriveImage_(fileId) {
  // ใช้ Drive v3 advanced service — เปิดใน Services ก่อน (id: "drive")
  // สร้าง Google Doc ผ่าน OCR แล้วดึงข้อความ แล้วลบทิ้ง
  const src = DriveApp.getFileById(fileId).getBlob();
  const resource = {
    name: 'ocr-tmp-' + Date.now(),
    mimeType: 'application/vnd.google-apps.document',
  };
  const docFile = Drive.Files.create(resource, src, {
    ocr: true,
    ocrLanguage: 'th',
    fields: 'id',
  });
  const text = DocumentApp.openById(docFile.id).getBody().getText();
  DriveApp.getFileById(docFile.id).setTrashed(true);
  return text;
}

// ───────────────────────────────────────────── helper

function toast_(msg) {
  SpreadsheetApp.getActive().toast(msg, 'Round Log', 5);
}
/**
 * Setup.gs — one-click installer
 *
 * รันครั้งเดียว → สร้างชีททุกตัวพร้อมสูตร, dropdown, checkbox, conditional format
 *
 *   Round Log → หน้าบันทึกแต่ละคู่
 *   Dashboard → สรุปรายพนักงาน + กำไรรายวัน
 *   Calendar  → ปฏิทิน 12 เดือน แสดงกำไรรายวัน
 */

const SETUP_DEFAULTS = {
  initialEmployees: ['T1', 'T2', 'T3'],
  statusList: ['Paid', 'Pending', 'Overdue', 'Cancelled'],
  calendarYear: new Date().getFullYear(),
};

function installAll() {
  const ss = SpreadsheetApp.getActive();
  setupRoundLog_(ss);
  setupDashboard_(ss);
  setupCalendar_(ss);
  setupSearch_(ss);
  createInstallableTrigger_();
  ss.toast('ติดตั้งเสร็จ! ไปที่ชีท Round Log เริ่มกรอกข้อมูลได้เลย', 'Setup', 8);
}

// ─────────────────────────────────── Round Log

function setupRoundLog_(ss) {
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  sh.clear();
  sh.clearConditionalFormatRules();

  const headers = [
    'คู่ที่',
    'Total Back (VND)', 'Total Back (THB)', 'Lay Stake',
    'Line1', 'Line2', 'Line3', 'Line4', 'Line5',
    'Paid By 1', 'Paid By 2', 'Paid By 3',
    'Remark', 'กำไรรวม', '✓', 'Match ID',
    ...SETUP_DEFAULTS.initialEmployees,
    'Log Time',
  ];

  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1f2937')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // hide Line1..Line5
  sh.hideColumns(5, 5);

  // freeze header
  sh.setFrozenRows(1);

  // checkbox column O
  sh.getRange('O2:O').insertCheckboxes();

  // number formats
  sh.getRange('B2:B').setNumberFormat('#,##0');
  sh.getRange('C2:C').setNumberFormat('#,##0.00');
  sh.getRange('D2:D').setNumberFormat('#,##0.00');
  sh.getRange('N2:N').setNumberFormat('#,##0;[red]-#,##0');
  // employee cols (Q onwards) before Log Time
  const empStart = 17;
  const empEnd = headers.length - 1;  // exclude Log Time
  if (empEnd >= empStart) {
    sh.getRange(2, empStart, sh.getMaxRows() - 1, empEnd - empStart + 1)
      .setNumberFormat('#,##0;[red]-#,##0');
  }
  sh.getRange(2, headers.length, sh.getMaxRows() - 1, 1)
    .setNumberFormat('yyyy-mm-dd hh:mm');

  // data validation: Status-like? Not required here; Remark is free text.

  // conditional formatting: N < 0 = red, N > 0 = green
  const nRange = sh.getRange('N2:N');
  const rules = sh.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0).setBackground('#d1fae5').setRanges([nRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0).setBackground('#fee2e2').setRanges([nRange]).build(),
  );
  sh.setConditionalFormatRules(rules);

  // column widths — เน้น Remark กว้าง, Line hidden
  sh.setColumnWidth(1, 60);
  sh.setColumnWidth(13, 280);  // Remark
  sh.setColumnWidth(16, 120);  // Match ID

  sh.activate();
}

// ─────────────────────────────────── Dashboard

const DASH_SHEET = 'Dashboard';

function setupDashboard_(ss) {
  let sh = ss.getSheetByName(DASH_SHEET);
  if (!sh) sh = ss.insertSheet(DASH_SHEET);
  sh.clear();

  const title = [['Round Log Dashboard', '', '', '', '']];
  sh.getRange(1, 1, 1, 5).setValues(title)
    .merge().setFontSize(16).setFontWeight('bold')
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // KPI block
  const kpi = [
    ['KPI', 'ค่า'],
    ['รวมกำไรทั้งหมด',       "=IFERROR(SUM('Round Log'!N2:N),0)"],
    ['จำนวนคู่ที่บันทึก',     "=COUNTA('Round Log'!P2:P)"],
    ['คู่ที่ปิดแล้ว (✓)',    "=COUNTIF('Round Log'!O2:O,TRUE)"],
    ['คู่ที่ยังเปิด',         "=COUNTA('Round Log'!P2:P)-COUNTIF('Round Log'!O2:O,TRUE)"],
    ['พนักงานได้มากสุด',     "=IFERROR(INDEX(A15:A,MATCH(MAX(B15:B),B15:B,0)),\"\")"],
    ['พนักงานเสียมากสุด',    "=IFERROR(INDEX(A15:A,MATCH(MIN(B15:B),B15:B,0)),\"\")"],
    ['อัปเดตล่าสุด',         '=NOW()'],
  ];
  sh.getRange(3, 1, kpi.length, 2).setValues(kpi);
  sh.getRange(3, 1, 1, 2).setFontWeight('bold').setBackground('#e5e7eb');
  sh.getRange(4, 2, 4, 1).setNumberFormat('#,##0;[red]-#,##0');
  sh.getRange(10, 2).setNumberFormat('yyyy-mm-dd hh:mm');

  // per-employee summary (rows 14 onwards)
  sh.getRange(13, 1, 1, 3).setValues([['สรุปรายพนักงาน', '', '']])
    .merge().setFontWeight('bold').setBackground('#374151').setFontColor('#ffffff');

  sh.getRange(14, 1, 1, 3).setValues([['พนักงาน', 'กำไร/ขาดทุนรวม', 'จำนวนคู่ที่เกี่ยว']])
    .setFontWeight('bold').setBackground('#e5e7eb');

  // dynamic per-employee: ใช้ QUERY รวมทุกคอลัมน์หลัง P ก่อน Log Time
  // ทริค: unpivot ด้วย TOCOL + LAMBDA — Google Sheets รองรับตั้งแต่ 2022
  sh.getRange('A15').setFormula(
    "=IFERROR(" +
    "LET(" +
      "logCol, MATCH(\"Log Time\", 'Round Log'!1:1, 0), " +
      "empCount, MAX(0, logCol - 17), " +
      "hdr, OFFSET('Round Log'!Q1, 0, 0, 1, empCount), " +
      "vals, OFFSET('Round Log'!Q2, 0, 0, 10000, empCount), " +
      "sums, BYCOL(vals, LAMBDA(col, SUM(col))), " +
      "cnts, BYCOL(vals, LAMBDA(col, COUNTIF(col, \"<>0\"))), " +
      "stacked, {TRANSPOSE(hdr), TRANSPOSE(sums), TRANSPOSE(cnts)}, " +
      "FILTER(stacked, INDEX(stacked,,1)<>\"\")" +
    "), \"กรอกข้อมูลใน Round Log ก่อน\")"
  );
  sh.getRange(15, 2, 50, 1).setNumberFormat('#,##0;[red]-#,##0');

  // daily profit (rows 14+ starting col E)
  sh.getRange(13, 5, 1, 2).setValues([['กำไรรายวัน', '']])
    .merge().setFontWeight('bold').setBackground('#374151').setFontColor('#ffffff');
  sh.getRange(14, 5, 1, 2).setValues([['วันที่', 'กำไรรวม']])
    .setFontWeight('bold').setBackground('#e5e7eb');
  sh.getRange('E15').setFormula(
    "=IFERROR(" +
    "LET(" +
      "logCol, MATCH(\"Log Time\", 'Round Log'!1:1, 0), " +
      "logLetter, REGEXEXTRACT(ADDRESS(1, logCol, 4), \"[A-Z]+\"), " +
      "dates, INDIRECT(\"'Round Log'!\"&logLetter&\"2:\"&logLetter), " +
      "QUERY({ARRAYFORMULA(IF(ISNUMBER(dates), INT(dates), \"\")), 'Round Log'!N2:N}, " +
      "\"select Col1, sum(Col2) where Col1 is not null and Col1 <> '' group by Col1 order by Col1 desc limit 30 label sum(Col2) 'กำไร'\", 0)" +
    "), \"ยังไม่มีข้อมูล\")"
  );
  sh.getRange(15, 5, 50, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(15, 6, 50, 1).setNumberFormat('#,##0;[red]-#,##0');

  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 140);
  sh.setColumnWidth(5, 140);
  sh.setColumnWidth(6, 140);
  sh.setFrozenRows(2);
}

// ─────────────────────────────────── Calendar (12 เดือน)

const CAL_SHEET = 'Calendar';

function setupCalendar_(ss) {
  let sh = ss.getSheetByName(CAL_SHEET);
  if (!sh) sh = ss.insertSheet(CAL_SHEET);
  sh.clear();

  const year = Number(SETUP_DEFAULTS.calendarYear) || new Date().getFullYear();

  sh.getRange(1, 1, 1, 4).setValues([[`ปฏิทินกำไรรายวัน ปี ${year}`, '', '', '']])
    .merge().setFontSize(14).setFontWeight('bold')
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // summary 12 months (col A-D)
  sh.getRange(3, 1, 1, 4).setValues([['เดือน', 'จำนวนคู่', 'กำไร', 'เปอร์เซ็นต์']])
    .setFontWeight('bold').setBackground('#e5e7eb');

  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const logRangeExpr =
    "INDIRECT(\"'Round Log'!\"&REGEXEXTRACT(ADDRESS(1,MATCH(\"Log Time\",'Round Log'!1:1,0),4),\"[A-Z]+\")&\":\"&REGEXEXTRACT(ADDRESS(1,MATCH(\"Log Time\",'Round Log'!1:1,0),4),\"[A-Z]+\"))";
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    rows.push([
      months[m - 1],
      `=COUNTIFS(${logRangeExpr},">="&DATE(${year},${m},1),${logRangeExpr},"<"&DATE(${year},${m}+1,1))`,
      `=SUMIFS('Round Log'!N:N,${logRangeExpr},">="&DATE(${year},${m},1),${logRangeExpr},"<"&DATE(${year},${m}+1,1))`,
      `=IFERROR(C${m+3}/SUM($C$4:$C$15),0)`,
    ]);
  }
  sh.getRange(4, 1, 12, 4).setValues(rows);
  sh.getRange(4, 3, 12, 1).setNumberFormat('#,##0;[red]-#,##0');
  sh.getRange(4, 4, 12, 1).setNumberFormat('0.0%');

  // total row
  sh.getRange(16, 1).setValue('รวม').setFontWeight('bold');
  sh.getRange(16, 2).setFormula('=SUM(B4:B15)').setFontWeight('bold');
  sh.getRange(16, 3).setFormula('=SUM(C4:C15)').setFontWeight('bold')
    .setNumberFormat('#,##0;[red]-#,##0');

  // conditional format กำไร column
  const cRange = sh.getRange('C4:C16');
  const rules = sh.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0).setBackground('#d1fae5').setRanges([cRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0).setBackground('#fee2e2').setRanges([cRange]).build(),
  );
  sh.setConditionalFormatRules(rules);

  sh.setColumnWidth(1, 100);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 140);
  sh.setColumnWidth(4, 100);
  sh.setFrozenRows(3);
}

// ─────────────────────────────────── Installable trigger (onEdit needs UrlFetch scope)

// ─────────────────────────────────── Search

const SEARCH_SHEET = 'Search';

function setupSearch_(ss) {
  let sh = ss.getSheetByName(SEARCH_SHEET);
  if (!sh) sh = ss.insertSheet(SEARCH_SHEET);
  sh.clear();
  sh.clearConditionalFormatRules();

  sh.getRange(1, 1, 1, 6).setValues([['ค้นหา Round Log', '', '', '', '', '']])
    .merge().setFontSize(14).setFontWeight('bold')
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // filter inputs (row 3)
  sh.getRange(3, 1, 1, 6).setValues([
    ['คำค้น (Remark/Match ID)', 'พนักงาน (เช่น T1)', 'จาก (วันที่)', 'ถึง (วันที่)', 'เฉพาะที่ปิดแล้ว ✓', 'รีเซ็ต']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  sh.getRange(4, 5).insertCheckboxes();
  sh.getRange(4, 3).setNumberFormat('yyyy-mm-dd');
  sh.getRange(4, 4).setNumberFormat('yyyy-mm-dd');
  sh.getRange(4, 6).setValue('ลบค่าด้านบนเพื่อรีเซ็ต').setFontStyle('italic').setFontColor('#6b7280');

  // results header (row 6)
  sh.getRange(6, 1, 1, 6).setValues([['คู่ที่', 'Match ID', 'วันที่', 'Remark', 'กำไรรวม', 'ปิดแล้ว']])
    .setFontWeight('bold').setBackground('#374151').setFontColor('#ffffff');

  // QUERY formula at A7 — กรองตามค่าใน row 4
  sh.getRange('A7').setFormula(
    "=IFERROR(" +
    "LET(" +
      "logCol, MATCH(\"Log Time\", 'Round Log'!1:1, 0), " +
      "logLetter, REGEXEXTRACT(ADDRESS(1, logCol, 4), \"[A-Z]+\"), " +
      "dates, INDIRECT(\"'Round Log'!\"&logLetter&\"2:\"&logLetter), " +
      "kw, A4, emp, UPPER(B4), df, C4, dt, D4, onlyClosed, E4, " +
      "pair, 'Round Log'!A2:A, " +
      "mid, 'Round Log'!P2:P, " +
      "remark, 'Round Log'!M2:M, " +
      "profit, 'Round Log'!N2:N, " +
      "closed, 'Round Log'!O2:O, " +
      "src, {pair, mid, dates, remark, profit, closed}, " +
      "FILTER(src, " +
        "pair<>\"\", " +
        "IF(kw=\"\", pair=pair, ISNUMBER(SEARCH(LOWER(kw), LOWER(remark&\" \"&mid)))), " +
        "IF(emp=\"\", pair=pair, ISNUMBER(SEARCH(emp, UPPER(remark)))), " +
        "IF(df=\"\", pair=pair, IFERROR(dates>=df, FALSE)), " +
        "IF(dt=\"\", pair=pair, IFERROR(dates<=dt+TIME(23,59,59), FALSE)), " +
        "IF(onlyClosed=TRUE, closed=TRUE, pair=pair)" +
      ")" +
    "), \"ไม่พบผลลัพธ์ — ลองลบ filter ดู\")"
  );

  sh.getRange(7, 3, 100, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(7, 5, 100, 1).setNumberFormat('#,##0;[red]-#,##0');

  sh.setColumnWidth(1, 60);
  sh.setColumnWidth(2, 120);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 280);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 80);
  sh.setFrozenRows(6);
}

// ─────────────────────────────────── Charts on Dashboard

function refreshCharts() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(DASH_SHEET);
  if (!sh) return;

  // ลบ chart เก่า
  sh.getCharts().forEach(c => sh.removeChart(c));

  const empRange = sh.getRange('A14:B40');
  const dailyRange = sh.getRange('E14:F44');

  const empChart = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(empRange)
    .setOption('title', 'กำไร/ขาดทุนรายพนักงาน')
    .setOption('legend', {position: 'none'})
    .setOption('width', 480)
    .setOption('height', 320)
    .setPosition(13, 8, 0, 0)
    .build();
  sh.insertChart(empChart);

  const dailyChart = sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dailyRange)
    .setOption('title', 'กำไรรายวัน')
    .setOption('legend', {position: 'none'})
    .setOption('width', 480)
    .setOption('height', 320)
    .setPosition(30, 8, 0, 0)
    .build();
  sh.insertChart(dailyChart);

  ss.toast('สร้างกราฟใน Dashboard แล้ว', 'Setup', 4);
}

// ─────────────────────────────────── Sample data

function insertSampleData() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { ss.toast('ยังไม่มีชีท Round Log — กด Install ก่อน', 'Setup', 6); return; }

  const lastRow = sh.getLastRow();
  const startRow = Math.max(lastRow + 1, 2);
  const today = new Date();
  const day = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

  const samples = [
    [1000000, 1300, 500, '', '', '', '', '', 'A', '', '', 'T1+1200 T2-500', '', false, 'M-001', day(2)],
    [800000,  1040, 400, '', '', '', '', '', 'A', '', '', 'ที1 ได้ 800', '', false, 'M-002', day(1)],
    [1500000, 1950, 600, '', '', '', '', '', 'B', '', '', 'T1,T2,T3+1000', '', false, 'M-003', day(1)],
    [600000,   780, 300, '', '', '', '', '', 'A', '', '', 'T2-300 T3+500', '', false, 'M-004', day(0)],
    [1200000, 1560, 480, '', '', '', '', '', 'C', '', '', 'T1 ได้1500 และ T3 เสีย200', '', false, 'M-005', day(0)],
  ];

  // เขียน column B..P (Total Back VND ถึง Match ID) แล้วเขียน Log Time ที่ logCol
  const logCol = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .findIndex(h => String(h).trim() === 'Log Time') + 1;

  samples.forEach((row, i) => {
    const r = startRow + i;
    // คอลัมน์ B (Total Back VND) ถึง P (Match ID) คือ index 0..14 ของ row
    sh.getRange(r, 2, 1, 15).setValues([row.slice(0, 15)]);
    // Log Time
    sh.getRange(r, logCol).setValue(row[15]);
    // คู่ที่ A
    sh.getRange(r, 1).setValue(r - 1);
    // trigger parse manually (เพราะ setValues ไม่กระตุ้น onEdit)
    const flat = flattenSummary(parseSummary(row[11]));
    if (Object.keys(flat).length) {
      applySummaryToRow_(r, flat);
      recalcProfit_(r);
    }
  });

  ss.toast('เพิ่ม 5 แถวตัวอย่าง — ดูผลที่ Dashboard / Calendar / Search', 'Setup', 8);
}

function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('ยืนยันลบข้อมูลทั้งหมดใน Round Log?',
    'header จะคงไว้, แต่ข้อมูลแถว 2 ลงไปจะถูกล้าง',
    ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) return;
  // ลบ protection ก่อน
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  ui.alert('ลบเรียบร้อย');
}

function createInstallableTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'handleEdit' ||
                 t.getHandlerFunction() === 'onEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}
