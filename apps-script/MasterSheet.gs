// ======================================================
// 🌕 MASTER SHEET SYSTEM — FINAL VERSION + LOCK ROWS (ยกเว้น Column O)
// ======================================================
// ✅ Auto Number + Auto Hide + Auto Freeze + Stake Display
// ✅ Expense Group Toggle
// ✅ Daily Sheet Generator + Monthly Summary + Index
// ✅ ล็อกแถวอัตโนมัติเมื่อติ๊ก A6:A46 (ยกเว้นคอลัมน์ O)

function onEdit(e) {
  if (!e) return;

  const sh = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // ========== CONFIG (ส่วนเดิมของพี่) ==========
  const range1 = { startRow: 6, endRow: 40, startCol: 5, endCol: 14 };   // E6:N40
  const range2 = { startRow: 6, endRow: 40, startCol: 18, endCol: 27 };  // R6:AA40
  const expenseGroup = { startRow: 41, endRow: 45, startCol: 5, endCol: 14 };
  const expenseExtra = { startRow: 41, endRow: 45, startCol: 12, endCol: 60 };
  const targetCol = 3;
  const firstVisible = 6;
  const secondVisible = 12;
  const lastRow = 40;
  const freezeStartRow = 46;

  // ---------- 🔒 ROW LOCK (checkbox in A6:A46) ----------
  if (
    col === 1 &&
    row >= 6 && row <= 46 &&
    e.range.getNumRows() === 1 &&
    e.range.getNumColumns() === 1
  ) {
    handleRowLock_(sh, row, e.range.getValue() === true);
  }

  // ---------- AUTO FREEZE ----------
  try {
    if (sh.getFrozenRows() < freezeStartRow - 1) sh.setFrozenRows(freezeStartRow - 1);
  } catch (err) { Logger.log("Freeze error: " + err); }

  // ---------- STAKE INPUT ----------
  if (row >= 6 && row <= 40 && col >= 18 && col <= 27) {
    handleStakeColumnDisplay_(sh, row, col);
  }

  // ---------- ตรวจช่วงสำหรับ Auto Number & Auto Hide ----------
  const inRange1 = row >= range1.startRow && row <= range1.endRow &&
                   col >= range1.startCol && col <= range1.endCol;
  const inRange2 = row >= range2.startRow && row <= range2.endRow &&
                   col >= range2.startCol && col <= range2.endCol;
  const inExpense = (
    (row >= expenseGroup.startRow && row <= expenseGroup.endRow && col >= expenseGroup.startCol && col <= expenseGroup.endCol) ||
    (row >= expenseExtra.startRow && row <= expenseExtra.endRow && col >= expenseExtra.startCol && col <= expenseExtra.endCol)
  );

  if (!inExpense && (inRange1 || inRange2)) {
    const rowValues1 = sh.getRange(row, range1.startCol, 1, range1.endCol - range1.startCol + 1).getValues()[0];
    const rowValues2 = sh.getRange(row, range2.startCol, 1, range2.endCol - range2.startCol + 1).getValues()[0];
    const rowHasData = rowValues1.concat(rowValues2).some(v => v !== "");
    const targetCell = sh.getRange(row, targetCol);

    if (rowHasData && targetCell.getValue() === "") resequenceNumbers_(sh, range1, range2, targetCol);
    if (!rowHasData && targetCell.getValue() !== "") {
      targetCell.clearContent();
      resequenceNumbers_(sh, range1, range2, targetCol);
    }

    autoHideRows_(sh, range1, range2, firstVisible, secondVisible, lastRow);
  }
}

// ======================================================
// 🔒 ROW LOCK HELPER — ล็อกทั้งแถวยกเว้นคอลัมน์ O
// ======================================================
function handleRowLock_(sh, row, isChecked) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tag = `ROW_LOCK_${sh.getSheetId()}_${row}`;

  const existing = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
                     .filter(p => p.getDescription() === tag);

  if (isChecked) {
    if (existing.length > 0) return;

    try {
      const lastCol = Math.max(sh.getLastColumn(), 15);
      const rowRange = sh.getRange(row, 1, 1, lastCol);
      const protection = rowRange.protect().setDescription(tag);

      protection.setUnprotectedRanges([sh.getRange(row, 15, 1, 1)]); // คอลัมน์ O

      const me = Session.getEffectiveUser();
      protection.addEditor(me);
      const others = protection.getEditors().filter(u => u.getEmail() !== me.getEmail());
      if (others.length) protection.removeEditors(others);
      if (protection.canDomainEdit()) protection.setDomainEdit(false);

      ss.toast(`🔒 แถวที่ ${row} ถูกล็อกแล้วค่ะพี่ลี่ (ยกเว้น Column O) 💕`, "Locked", 4);
    } catch (err) {
      Logger.log("Lock error: " + err);
      ss.toast(`⚠️ ล็อกแถวไม่สำเร็จ: ${err.message}`, "Error", 6);
    }
  } else {
    if (existing.length === 0) return;
    existing.forEach(p => p.remove());
    ss.toast(`🔓 แถวที่ ${row} ถูกปลดล็อกแล้วค่ะ`, "Unlocked", 4);
  }
}

// ======================================================
// ฟังก์ชันเดิมทั้งหมดของพี่ (วาวาไม่แตะ)
// ======================================================
function resequenceNumbers_(sh, range1, range2, targetCol) {
  let currentNum = 1;
  for (let r = range1.startRow; r <= range1.endRow; r++) {
    const rowValues1 = sh.getRange(r, range1.startCol, 1, range1.endCol - range1.startCol + 1).getValues()[0];
    const rowValues2 = sh.getRange(r, range2.startCol, 1, range2.endCol - range2.startCol + 1).getValues()[0];
    const hasData = rowValues1.concat(rowValues2).some(v => v !== "");
    const targetCell = sh.getRange(r, targetCol);
    if (hasData) targetCell.setValue(currentNum++);
    else targetCell.clearContent();
  }
}

function autoHideRows_(sh, range1, range2, firstVisible, secondVisible, lastRow) {
  sh.showRows(firstVisible, 2);
  let lastDataRow = secondVisible;
  for (let r = range1.startRow; r <= range1.endRow; r++) {
    const rowValues1 = sh.getRange(r, range1.startCol, 1, range1.endCol - range1.startCol + 1).getValues()[0];
    const rowValues2 = sh.getRange(r, range2.startCol, 1, range2.endCol - range2.startCol + 1).getValues()[0];
    const hasData = rowValues1.concat(rowValues2).some(v => v !== "");
    if (hasData) lastDataRow = r;
  }
  const showUntil = Math.min(lastDataRow + 1, lastRow);
  sh.showRows(firstVisible, showUntil - firstVisible + 1);
  if (showUntil < lastRow) sh.hideRows(showUntil + 1, lastRow - showUntil);
}

function toggleExpenseGroup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const firstRow = 41;
  const numRows = 5;
  const firstCol = 11; // K
  const numCols = 4;   // K:N
  const color = "#f3f3f3";

  const isHidden = sh.isRowHiddenByUser(firstRow);

  if (isHidden) {
    sh.showColumns(firstCol, numCols);
    sh.showRows(firstRow, numRows);
    sh.getRange(`K${firstRow}:N${firstRow + numRows - 1}`)
      .setBackground(color)
      .setFontWeight("bold");
    ss.toast("✅ แสดงกลุ่มค่าใช้จ่ายแล้ว", "Expense Group");
  } else {
    sh.getRange(`K${firstRow}:N${firstRow + numRows - 1}`).setBackground(null);
    sh.hideColumns(firstCol, numCols);
    sh.hideRows(firstRow, numRows);
    ss.toast("🙈 ซ่อนกลุ่มค่าใช้จ่ายแล้ว", "Expense Group");
  }
}

function initializeStakeColumns_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sh.showColumns(18, 3);
  sh.hideColumns(21, 7);
}

function handleStakeColumnDisplay_(sh, row, col) {
  const firstCol = 18, lastCol = 27;
  const value = sh.getRange(row, col).getValue();
  if (sh.isColumnHiddenByUser(col)) return;
  if (!isNaN(value) && value !== "" && col < lastCol) sh.showColumns(col + 1);
}

function resetStakeColumns() { initializeStakeColumns_(); }

function refreshLayout() {
  const sh = SpreadsheetApp.getActiveSheet();
  const freezeStartRow = 46;
  sh.showRows(1, sh.getMaxRows());
  sh.setFrozenRows(freezeStartRow - 1);
  initializeStakeColumns_();
  onEdit({ range: sh.getRange("E6") });
}

function createNextDaySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const template = ss.getSheetByName("Template");
  if (!template) { SpreadsheetApp.getUi().alert("❌ Template not found!"); return; }

  const sheets = ss.getSheets();
  const dateRegex = /^\d{2}-[A-Za-z]{3}-\d{4}$/;
  let lastDate = null;
  for (let sh of sheets) {
    if (dateRegex.test(sh.getName())) {
      const d = new Date(sh.getName());
      if (!isNaN(d) && (!lastDate || d > lastDate)) lastDate = d;
    }
  }

  const baseDate = lastDate ? new Date(lastDate) : new Date();
  const nextDate = new Date(baseDate); nextDate.setDate(baseDate.getDate() + 1);
  const newName = Utilities.formatDate(nextDate, Session.getScriptTimeZone(), "dd-MMM-yyyy");
  const newSheet = template.copyTo(ss).setName(newName);

  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const weekday = days[nextDate.getDay()];
  const dayColors = {
    Sunday:"#9B1C1C", Monday:"#FFFF66", Tuesday:"#F87171",
    Wednesday:"#22C55E", Thursday:"#F59E0B", Friday:"#60A5FA", Saturday:"#6D28D9"
  };

  newSheet.getRange("B1:D1").merge().setValue(weekday)
    .setHorizontalAlignment("center").setFontWeight("bold")
    .setBackground(dayColors[weekday] || "#FFFFFF");
  const formattedDate = Utilities.formatDate(nextDate, Session.getScriptTimeZone(), "dd/MMM/yyyy");
  newSheet.getRange("B2:D2").merge().setValue(formattedDate).setHorizontalAlignment("center");

  updateMonthlySummary();
  updateIndexSheet();
  SpreadsheetApp.getUi().alert("✅ Created new daily sheet: " + newName);
}

function updateMonthlySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dateRegex = /^\d{2}-[A-Za-z]{3}-\d{4}$/;
  const sheets = ss.getSheets().filter(sh => dateRegex.test(sh.getName()));

  const grouped = {};
  for (let sh of sheets) {
    const dateStr = sh.getName();
    const d = new Date(dateStr);
    const monthKey = Utilities.formatDate(d, Session.getScriptTimeZone(), "MMM-yyyy");
    if (!grouped[monthKey]) grouped[monthKey] = [];
    const d48 = sh.getRange("D48").getValue();
    const c48 = sh.getRange("C48").getValue() || "";
    const formattedDate = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
    grouped[monthKey].push([formattedDate, d48, c48]);
  }

  for (let month in grouped) {
    const sheetName = `Summary-${month}`;
    let summarySheet = ss.getSheetByName(sheetName);
    if (!summarySheet) summarySheet = ss.insertSheet(sheetName);
    summarySheet.clear();
    summarySheet.appendRow(["Date", "Profit", "Notes"]);
    summarySheet.getRange(2, 1, grouped[month].length, 3).setValues(grouped[month]);
  }
}

function updateIndexSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indexName = "Index";
  const dateRegex = /^\d{2}-[A-Za-z]{3}-\d{4}$/;
  let indexSheet = ss.getSheetByName(indexName);
  if (!indexSheet) indexSheet = ss.insertSheet(indexName); else indexSheet.clear();

  indexSheet.getRange("A1").setValue("📅 Date").setFontWeight("bold");
  indexSheet.getRange("B1").setValue("🗓️ Day").setFontWeight("bold");
  indexSheet.setColumnWidths(1, 2, 160);

  const sheets = ss.getSheets().filter(sh => dateRegex.test(sh.getName()));
  const dayColors = {
    Sunday:"#9B1C1C", Monday:"#FFFF66", Tuesday:"#F87171",
    Wednesday:"#22C55E", Thursday:"#F59E0B", Friday:"#60A5FA", Saturday:"#6D28D9"
  };

  let row = 2;
  for (let sh of sheets.sort((a,b)=>new Date(a.getName())-new Date(b.getName()))) {
    const dateStr = sh.getName();
    const d = new Date(dateStr);
    const weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
    const color = dayColors[weekday] || "#FFFFFF";
    const formula = `=HYPERLINK("#gid=${sh.getSheetId()}", "${dateStr}")`;
    indexSheet.getRange(row, 1).setFormula(formula).setBackground(color).setFontWeight("bold");
    indexSheet.getRange(row, 2).setValue(weekday).setBackground(color).setFontWeight("bold");
    row++;
  }
  indexSheet.getRange("A1:B1").setBackground("#000000").setFontColor("#FFFFFF");
}

function stepUp() { stepShiftSelected_('R6:AA45', +0.1); }
function stepDown() { stepShiftSelected_('R6:AA45', -0.1); }

function Add10000() { fixedShiftSelected_('E6:CC45', +10000); }
function Sub10000() { fixedShiftSelected_('E6:CC45', -10000); }
function Add1000() { fixedShiftSelected_('E6:CC45', +1000); }
function Sub1000() { fixedShiftSelected_('E6:CC45', -1000); }
function Add100() { fixedShiftSelected_('E6:CC45', +100); }
function Sub100() { fixedShiftSelected_('E6:CC45', -100); }

function stepShiftSelected_(allowedRangeA1, direction) {
  const sh = SpreadsheetApp.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  const selection = sh.getActiveRange();
  const allowed = sh.getRange(allowedRangeA1);
  const base = Number(sh.getRange('C3').getValue());
  if (isNaN(base)) throw new Error('C3 ต้องเป็นตัวเลข');

  const delta = base * 10 * direction;
  const intersect = getIntersectRange_(selection, allowed);

  if (!intersect) {
    ui.alert(`❌ เซลล์ที่เลือกอยู่นอกช่วงที่กำหนด (${allowedRangeA1})`);
    return;
  }

  const vals = intersect.getValues();
  for (let r = 0; r < vals.length; r++) {
    for (let c = 0; c < vals[r].length; c++) {
      const cell = vals[r][c];
      if (cell === "" || cell === null) {
        vals[r][c] = delta;
      } else if (!isNaN(Number(cell))) {
        vals[r][c] = Number(cell) + delta;
      } else {
        vals[r][c] = delta;
      }
    }
  }
  intersect.setValues(vals);
}

function fixedShiftSelected_(allowedRangeA1, step) {
  const sh = SpreadsheetApp.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  const selection = sh.getActiveRange();
  const allowed = sh.getRange(allowedRangeA1);
  const intersect = getIntersectRange_(selection, allowed);

  if (!intersect) {
    ui.alert(`❌ เซลล์ที่เลือกอยู่นอกช่วงที่กำหนด (${allowedRangeA1})`);
    return;
  }

  const vals = intersect.getValues();
  for (let r = 0; r < vals.length; r++) {
    for (let c = 0; c < vals[r].length; c++) {
      const cell = vals[r][c];
      if (cell === "" || cell === null) {
        vals[r][c] = step;
      } else if (!isNaN(Number(cell))) {
        vals[r][c] = Number(cell) + step;
      } else {
        vals[r][c] = step;
      }
    }
  }
  intersect.setValues(vals);
}

function getIntersectRange_(sel, allowed) {
  const sh = sel.getSheet();
  if (sh.getName() !== allowed.getSheet().getName()) return null;

  const sRow = sel.getRow(), sCol = sel.getColumn();
  const eRow = sRow + sel.getNumRows() - 1, eCol = sCol + sel.getNumColumns() - 1;
  const aRow = allowed.getRow(), aCol = allowed.getColumn();
  const aERow = aRow + allowed.getNumRows() - 1, aECol = aCol + allowed.getNumColumns() - 1;

  const rowStart = Math.max(sRow, aRow);
  const rowEnd = Math.min(eRow, aERow);
  const colStart = Math.max(sCol, aCol);
  const colEnd = Math.min(eCol, aECol);

  if (rowEnd < rowStart || colEnd < colStart) return null;

  return sh.getRange(rowStart, colStart, rowEnd - rowStart + 1, colEnd - colStart + 1);
}
