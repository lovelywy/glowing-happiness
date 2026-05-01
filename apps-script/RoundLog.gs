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
