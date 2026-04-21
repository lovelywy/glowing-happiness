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
