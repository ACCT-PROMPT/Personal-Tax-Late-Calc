import type { HistoryRecord } from './history';
import { thaiDate, thaiDateTime } from './history';
import { LEGAL_BASIS, THAI_TAX_BRACKETS } from './taxCalc';
import { INCOME_TAX_SOURCE } from './incomeTax';

// ExcelJS ค่อนข้างใหญ่ จึงโหลดเมื่อกดส่งออกเท่านั้น (ไม่ทำให้หน้าแรกช้า)
async function loadExcelJS() {
  const mod = await import('exceljs');
  return (mod as any).default ?? mod;
}

const FONT = 'Tahoma';
const MONEY = '#,##0.00';
const NAVY = 'FF1E1B4B';
const INDIGO = 'FF4338CA';
const LIGHT = 'FFEEF2FF';
const INPUT_BG = 'FFFEF9C3'; // ช่องที่เป็นข้อมูลนำเข้า (แก้ได้ สูตรจะคำนวณใหม่)
const BORDER = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const STATUS_TEXT = 'สถานะ: ประมาณการ (ไม่ใช่การประเมินภาษีของเจ้าพนักงาน) ช่องสีเหลืองแก้ไขได้ สูตรจะคำนวณใหม่ให้';

function download(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// ชื่อไฟล์ใช้อักขระที่ปลอดภัยกับทุกระบบ
function safe(text: string): string {
  return text.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
}

function fill(cell: any, argb: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function titleBar(ws: any, text: string, lastCol: number) {
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = text;
  t.font = { name: FONT, size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  fill(t, NAVY);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;
}

function headerRow(ws: any, row: number, labels: string[], color = NAVY) {
  labels.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    fill(c, color);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = ALL_BORDERS;
  });
}

// ---------------------------------------------------------------- ผลการคำนวณรายการเดียว
export async function exportRecordToExcel(r: HistoryRecord): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ระบบคิดค่าปรับภาษี';
  wb.created = new Date();
  const ws = wb.addWorksheet('สรุปผล', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 8 }, { width: 40 }, { width: 22 }, { width: 56 }];
  const base = { name: FONT, size: 11 };
  const res = r.result;

  titleBar(ws, `สรุปการคำนวณเบี้ยปรับและเงินเพิ่ม — ${r.taxTypeText}`, 4);
  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `ออกรายงานเมื่อ ${thaiDateTime(new Date().toISOString())}${r.label ? `   |   อ้างอิง: ${r.label}` : ''}`;
  ws.getCell('A2').font = { name: FONT, size: 10, color: { argb: 'FF64748B' } };
  ws.mergeCells('A3:D3');
  ws.getCell('A3').value = STATUS_TEXT;
  ws.getCell('A3').font = { name: FONT, size: 10, italic: true, color: { argb: 'FFB45309' } };

  // ---- ข้อมูลทั่วไป
  const info: [string, string | number][] = [
    ['ประเภทภาษี', r.taxTypeText],
    [r.kind === 'pit' ? 'ปีภาษี' : 'เดือนภาษี', r.periodText],
    ['ช่องทางการยื่นแบบ', r.methodText],
    ['ลักษณะการยื่น', r.scenarioText],
    ['วันครบกำหนดชำระ', thaiDate(r.deadline) + (r.inputs.customDeadline ? ' (กำหนดเอง)' : '')],
    ['วันที่ยื่นแบบ', r.inputs.filingDate ? thaiDate(r.inputs.filingDate) : 'ยื่นและชำระวันเดียวกัน'],
    ['วันที่ชำระจริง / คาดว่าจะชำระ', thaiDate(r.inputs.paymentDate)],
    ['เงื่อนไขเบี้ยปรับที่ใช้', r.penaltyRuleText],
  ];
  let row = 5;
  info.forEach(([k, v]) => {
    ws.mergeCells(`C${row}:D${row}`);
    const kcell = ws.getCell(`B${row}`);
    kcell.value = k;
    kcell.font = { ...base, bold: true };
    fill(kcell, LIGHT);
    kcell.border = ALL_BORDERS;
    const vcell = ws.getCell(`C${row}`);
    vcell.value = v;
    vcell.font = base;
    vcell.alignment = { horizontal: 'left', wrapText: true, vertical: 'top' };
    vcell.border = ALL_BORDERS;
    ws.getCell(`D${row}`).border = ALL_BORDERS;
    row++;
  });

  // ---- ตัวแปรที่ใช้คำนวณ (ช่องสีเหลืองแก้ได้)
  row += 1;
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = 'ข้อมูลที่ใช้คำนวณ (ช่องสีเหลืองแก้ไขได้ ตารางด้านล่างจะคำนวณใหม่)';
  ws.getCell(`A${row}`).font = { name: FONT, size: 12, bold: true, color: { argb: NAVY } };
  row++;
  const params: { key: string; label: string; value: number; fmt: string; note: string }[] = [
    { key: 'tax', label: 'ภาษีที่ค้างชำระ (บาท)', value: res.taxOwed, fmt: MONEY, note: 'ยอดภาษีที่จ่ายไม่ครบ หรือที่ถูกประเมิน' },
    { key: 'rate', label: 'อัตราเงินเพิ่มต่อเดือน', value: 0.015, fmt: '0.0%', note: r.kind === 'pit' ? 'ประมวลรัษฎากร ม.27' : 'ประมวลรัษฎากร ม.89/1' },
    { key: 'months', label: 'จำนวนเดือนที่ล่าช้า', value: res.monthsLate, fmt: '0', note: 'นับจากวันถัดจากวันครบกำหนดถึงวันที่ชำระ เศษของเดือนนับเป็น 1 เดือน' },
    { key: 'mult', label: 'เบี้ยปรับตามกฎหมาย (เท่าของภาษี)', value: res.penaltyMultiplier, fmt: '0.0', note: '0 = ไม่มีเบี้ยปรับ' },
    { key: 'pct', label: '% ของเบี้ยปรับที่ต้องเสีย', value: res.penaltyDiscountPercent, fmt: '0"%"', note: r.penaltyRuleText },
    { key: 'fine', label: 'ค่าปรับอาญา (ตามที่สรรพากรแจ้ง)', value: res.criminalFine, fmt: MONEY, note: res.criminalFineApplies ? (res.criminalFine > 0 ? 'ตามที่ผู้ใช้กรอก' : 'เข้าเงื่อนไข แต่ยังไม่ได้กรอกจำนวน') : 'ไม่เข้าเงื่อนไข' },
  ];
  const pos: Record<string, string> = {};
  params.forEach((p) => {
    ws.getCell(row, 1).value = '';
    const k = ws.getCell(row, 2);
    k.value = p.label;
    k.font = { ...base, bold: true };
    fill(k, LIGHT);
    k.border = ALL_BORDERS;
    const v = ws.getCell(row, 3);
    v.value = p.value;
    v.numFmt = p.fmt;
    v.font = { ...base, color: { argb: 'FF1D4ED8' } };
    v.alignment = { horizontal: 'right' };
    fill(v, INPUT_BG);
    v.border = ALL_BORDERS;
    const n = ws.getCell(row, 4);
    n.value = p.note;
    n.font = { name: FONT, size: 10, color: { argb: 'FF64748B' } };
    n.alignment = { wrapText: true, vertical: 'top' };
    n.border = ALL_BORDERS;
    pos[p.key] = `$C$${row}`;
    row++;
  });

  // ---- ตารางรายการ (สูตร)
  row += 1;
  headerRow(ws, row, ['ลำดับ', 'รายการ', 'จำนวนเงิน (บาท)', 'สูตร / หมายเหตุ']);
  const headRow = row;
  row++;
  const t = pos.tax, rt = pos.rate, mo = pos.months, mu = pos.mult, pc = pos.pct, fn = pos.fine;
  const surchargeSec = r.kind === 'pit' ? 'ม.27' : 'ม.89/1';
  const penaltySec = r.kind === 'pit' ? 'ม.22' : 'ม.89';
  const items: [number, string, any, string][] = [
    [1, 'ภาษีที่ค้างชำระ', { formula: `${t}`, result: res.taxOwed }, 'ยอดภาษีตามที่ระบุด้านบน'],
    [2, `เงินเพิ่ม (${surchargeSec})`, { formula: `ROUND(MIN(${t}*${rt}*${mo},${t}),2)`, result: res.surcharge }, 'ภาษี × อัตราต่อเดือน × จำนวนเดือน แต่ไม่เกินยอดภาษี'],
    [3, `เบี้ยปรับ (${penaltySec})`, { formula: `ROUND(ROUND(${t}*${mu},2)*${pc}/100,2)`, result: res.penaltyReduced }, 'ภาษี × เท่าตามกฎหมาย × % ที่ต้องเสีย'],
    [4, 'ค่าปรับอาญา', { formula: `${fn}`, result: res.criminalFine }, res.criminalFineApplies && res.criminalFine === 0 ? 'ยังไม่รวมในยอด (ยังไม่ได้กรอกจำนวนที่สรรพากรแจ้ง)' : 'ตามที่สรรพากรแจ้ง'],
  ];
  const firstItem = row;
  items.forEach(([no, name, value, note]) => {
    const c1 = ws.getCell(row, 1);
    c1.value = no;
    c1.alignment = { horizontal: 'center', vertical: 'top' };
    const c2 = ws.getCell(row, 2);
    c2.value = name;
    c2.alignment = { vertical: 'top' };
    const c3 = ws.getCell(row, 3);
    c3.value = value;
    c3.numFmt = MONEY;
    c3.alignment = { horizontal: 'right', vertical: 'top' };
    const c4 = ws.getCell(row, 4);
    c4.value = note;
    c4.alignment = { wrapText: true, vertical: 'top' };
    [c1, c2, c3, c4].forEach((c) => {
      c.font = base;
      c.border = ALL_BORDERS;
    });
    row++;
  });
  const lastItem = row - 1;

  ws.getCell(row, 1).value = '';
  ws.getCell(row, 2).value = 'ยอดรวมที่ต้องชำระ';
  const tv = ws.getCell(row, 3);
  tv.value = { formula: `SUM(C${firstItem}:C${lastItem})`, result: res.totalToPay };
  tv.numFmt = MONEY;
  tv.alignment = { horizontal: 'right' };
  ws.getCell(row, 4).value = res.criminalFineApplies && res.criminalFine === 0 ? 'ยังไม่รวมค่าปรับอาญา' : '';
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { name: FONT, size: 12, bold: true };
    fill(cell, LIGHT);
    cell.border = ALL_BORDERS;
  }
  row += 2;

  if (res.penaltyOriginal > 0) {
    ws.getCell(row, 2).value = 'เบี้ยปรับเต็มตามกฎหมาย';
    ws.getCell(row, 3).value = { formula: `ROUND(${t}*${mu},2)`, result: res.penaltyOriginal };
    ws.getCell(row + 1, 2).value = 'ประหยัดเบี้ยปรับได้';
    ws.getCell(row + 1, 3).value = { formula: `C${row}-C${firstItem + 2}`, result: res.penaltyOriginal - res.penaltyReduced };
    [row, row + 1].forEach((rr) => {
      ws.getCell(rr, 3).numFmt = MONEY;
      ws.getCell(rr, 2).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
      ws.getCell(rr, 3).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
    });
    row += 3;
  }

  ws.mergeCells(`A${row}:D${row + 2}`);
  const note = ws.getCell(`A${row}`);
  note.value =
    `หมายเหตุ: ผลลัพธ์เป็นการประมาณการ การลดเบี้ยปรับเป็นดุลพินิจของเจ้าพนักงาน ` +
    `อ้างอิง ${LEGAL_BASIS.directive} (${LEGAL_BASIS.url}) ตรวจสอบล่าสุด ${LEGAL_BASIS.checkedOn} ` +
    `ควรยืนยันกับเจ้าหน้าที่สรรพากรก่อนชำระจริง`;
  note.font = { name: FONT, size: 9, color: { argb: 'FF64748B' } };
  note.alignment = { wrapText: true, vertical: 'top' };

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`;

  // ---- แผ่นที่ 2: ที่มาของภาษี (เมื่อใช้ตัวช่วยคำนวณรายได้)
  if (r.estimate) addEstimateSheet(wb, r, base);

  const buf = await wb.xlsx.writeBuffer();
  const name = safe(`${r.kind === 'pit' ? 'ภงด90-91' : 'ภพ30'}_${r.periodText}${r.label ? '_' + r.label : ''}`);
  download(buf as ArrayBuffer, `ค่าปรับภาษี_${name}_${stamp()}.xlsx`);
}

function addEstimateSheet(wb: any, r: HistoryRecord, base: { name: string; size: number }) {
  const e = r.estimate!;
  const ws = wb.addWorksheet('ที่มาของภาษี', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 44 }, { width: 20 }, { width: 38 }, { width: 20 }, { width: 22 }];
  titleBar(ws, 'ที่มาของยอดภาษีที่ค้างชำระ (ภ.ง.ด.90/91)', 5);
  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = STATUS_TEXT;
  ws.getCell('A2').font = { name: FONT, size: 10, italic: true, color: { argb: 'FFB45309' } };

  let row = 4;
  const section = (text: string) => {
    ws.mergeCells(`A${row}:E${row}`);
    ws.getCell(`A${row}`).value = text;
    ws.getCell(`A${row}`).font = { name: FONT, size: 12, bold: true, color: { argb: NAVY } };
    row++;
  };
  const put = (c: number, v: any, o: { fmt?: string; bold?: boolean; input?: boolean; align?: string; wrap?: boolean } = {}) => {
    const cell = ws.getCell(row, c);
    cell.value = v;
    cell.font = { ...base, bold: !!o.bold, color: o.input ? { argb: 'FF1D4ED8' } : undefined };
    if (o.fmt) cell.numFmt = o.fmt;
    if (o.input) fill(cell, INPUT_BG);
    cell.border = ALL_BORDERS;
    cell.alignment = { horizontal: (o.align as any) || (typeof v === 'number' || (v && v.formula) ? 'right' : 'left'), vertical: 'top', wrapText: o.wrap };
  };

  // 1) เงินได้และค่าใช้จ่าย
  section('1) เงินได้และค่าใช้จ่าย');
  headerRow(ws, row, ['ประเภทเงินได้', 'เงินได้ทั้งปี', 'วิธีหักค่าใช้จ่าย', 'ค่าใช้จ่าย', 'เงินได้หลังหักค่าใช้จ่าย']);
  row++;
  const l0 = row;
  e.lines.forEach((l) => {
    put(1, `${l.title} ${l.section}`, { wrap: true });
    put(2, l.amount, { fmt: MONEY, input: true });
    put(3, l.basis, { wrap: true });
    put(4, l.expense, { fmt: MONEY });
    put(5, { formula: `B${row}-D${row}`, result: l.net }, { fmt: MONEY });
    row++;
  });
  const l1 = row - 1;
  put(1, 'รวม', { bold: true });
  put(2, { formula: `SUM(B${l0}:B${l1})`, result: e.assessableIncome }, { fmt: MONEY, bold: true });
  put(3, '');
  put(4, { formula: `SUM(D${l0}:D${l1})`, result: e.totalExpenses }, { fmt: MONEY, bold: true });
  put(5, { formula: `SUM(E${l0}:E${l1})`, result: e.assessableIncome - e.totalExpenses }, { fmt: MONEY, bold: true });
  const sumRow = row;
  row += 2;

  // 2) ค่าลดหย่อน
  section('2) ค่าลดหย่อน');
  headerRow(ws, row, ['รายการ', 'ที่กรอก/นับได้', 'เพดาน', 'ใช้ได้จริง', '']);
  row++;
  const a0 = row;
  e.allowances.forEach((a) => {
    put(1, a.label, { wrap: true });
    put(2, a.claimed, { fmt: MONEY, input: true });
    put(3, a.capNote, { wrap: true });
    put(4, a.allowed, { fmt: MONEY });
    put(5, '');
    row++;
  });
  const a1 = row - 1;
  put(1, 'รวมค่าลดหย่อน', { bold: true });
  put(2, '');
  put(3, '');
  put(4, { formula: `SUM(D${a0}:D${a1})`, result: e.totalAllowances }, { fmt: MONEY, bold: true });
  put(5, '');
  const allowRow = row;
  row += 2;

  // 3) เงินได้สุทธิและภาษี
  section('3) เงินได้สุทธิและภาษี');
  const netRow = row;
  put(1, 'เงินได้สุทธิ = เงินได้รวม − ค่าใช้จ่าย − ค่าลดหย่อน (ไม่ต่ำกว่า 0)', { bold: true, wrap: true });
  put(2, { formula: `MAX(0,B${sumRow}-D${sumRow}-D${allowRow})`, result: e.netIncome }, { fmt: MONEY, bold: true });
  row += 2;

  headerRow(ws, row, ['ขั้นเงินได้สุทธิ (บาท)', 'อัตราภาษี', 'เงินได้ที่ตกในขั้นนี้', 'ภาษีขั้นนี้', '']);
  row++;
  const b0 = row;
  let lower = 0;
  THAI_TAX_BRACKETS.forEach((b) => {
    const upper = b.max === Infinity ? 1e12 : b.max;
    put(1, b.max === Infinity ? `เกิน ${lower.toLocaleString('en-US')}` : `${lower.toLocaleString('en-US')} – ${b.max.toLocaleString('en-US')}`);
    put(2, b.rate, { fmt: '0%' });
    const inBracket = Math.max(0, Math.min(e.netIncome, upper) - lower);
    put(3, { formula: `MAX(0,MIN($B$${netRow},${upper})-${lower})`, result: inBracket }, { fmt: MONEY });
    put(4, { formula: `C${row}*B${row}`, result: inBracket * b.rate }, { fmt: MONEY });
    put(5, '');
    lower = b.max === Infinity ? lower : b.max;
    row++;
  });
  const b1 = row - 1;
  put(1, 'ภาษีตามอัตราก้าวหน้า (วิธีที่ 1) ปัดเป็นบาท', { bold: true });
  put(2, '');
  put(3, '');
  put(4, { formula: `ROUND(SUM(D${b0}:D${b1}),0)`, result: e.progressiveTax }, { fmt: MONEY, bold: true });
  put(5, '');
  const progRow = row;
  row += 2;

  const sumLine = (label: string, v: any, bold = false) => {
    put(1, label, { bold, wrap: true });
    put(2, v, { fmt: MONEY, bold });
    row++;
  };
  const minBaseRow = row;
  sumLine(`เงินได้ 40(2)-(8) รวม (ฐานภาษีขั้นต่ำ) — ${INCOME_TAX_SOURCE.minTax}`, e.minTaxBase);
  const minRow = row;
  sumLine('ภาษีขั้นต่ำ 0.5% (วิธีที่ 2) ใช้เมื่อฐานตั้งแต่ 120,000 บาท', { formula: `IF(B${minBaseRow}>=120000,ROUND(B${minBaseRow}*0.005,2),0)`, result: e.minTax });
  const totalRow = row;
  sumLine('ภาษีที่ต้องเสีย = ค่าที่สูงกว่าของวิธีที่ 1 และวิธีที่ 2', { formula: `MAX(D${progRow},B${minRow})`, result: e.taxTotal }, true);
  const credRow = row;
  put(1, 'หัก ภาษีที่จ่ายไปแล้ว (หัก ณ ที่จ่าย + ภ.ง.ด.94)', { wrap: true });
  put(2, e.credits, { fmt: MONEY, input: true });
  row++;
  sumLine('ภาษีที่ขาด ต้องชำระเพิ่ม', { formula: `MAX(0,B${totalRow}-B${credRow})`, result: e.additionalTax }, true);
  sumLine('ภาษีที่ชำระไว้เกิน (ขอคืนได้)', { formula: `MAX(0,B${credRow}-B${totalRow})`, result: e.refund });
  row += 1;
  ws.mergeCells(`A${row}:E${row + 1}`);
  const n = ws.getCell(`A${row}`);
  n.value = `อัตราหักค่าใช้จ่ายอ้างอิง ${INCOME_TAX_SOURCE.expenses} ค่าลดหย่อนอ้างอิง${INCOME_TAX_SOURCE.allowances}`;
  n.font = { name: FONT, size: 9, color: { argb: 'FF64748B' } };
  n.alignment = { wrapText: true, vertical: 'top' };
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ---------------------------------------------------------------- ประวัติทั้งหมด
export async function exportHistoryToExcel(records: HistoryRecord[]): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ระบบคิดค่าปรับภาษี';
  wb.created = new Date();
  const ws = wb.addWorksheet('ประวัติการคำนวณ', { views: [{ state: 'frozen', ySplit: 3 }] });

  const cols = [
    { header: 'ลำดับ', width: 8 }, // A
    { header: 'บันทึกเมื่อ', width: 20 }, // B
    { header: 'อ้างอิง / ชื่อลูกค้า', width: 26 }, // C
    { header: 'ประเภทภาษี', width: 24 }, // D
    { header: 'ปีภาษี / เดือนภาษี', width: 20 }, // E
    { header: 'ลักษณะการยื่น', width: 34 }, // F
    { header: 'วันครบกำหนด', width: 15 }, // G
    { header: 'วันที่ชำระ', width: 15 }, // H
    { header: 'ล่าช้า (เดือน)', width: 12 }, // I
    { header: 'ภาษีที่ค้างชำระ', width: 17 }, // J
    { header: 'เงินเพิ่ม', width: 15 }, // K = สูตร
    { header: 'เบี้ยปรับตามกฎหมาย (เท่า)', width: 15 }, // L
    { header: '% ที่ต้องเสีย', width: 11 }, // M
    { header: 'เบี้ยปรับที่ต้องเสีย', width: 17 }, // N = สูตร
    { header: 'ค่าปรับอาญา', width: 15 }, // O
    { header: 'ยอดรวมที่ต้องชำระ', width: 19 }, // P = สูตร
    { header: 'หมายเหตุ', width: 42 }, // Q
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));
  const lastCol = cols.length;

  titleBar(ws, 'ประวัติการคำนวณเบี้ยปรับและเงินเพิ่ม (ประมาณการ)', lastCol);
  ws.mergeCells(2, 1, 2, 9);
  ws.getCell(2, 1).value = `ออกรายงานเมื่อ ${thaiDateTime(new Date().toISOString())}   |   ทั้งหมด ${records.length} รายการ   |   ${STATUS_TEXT}`;
  ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF64748B' } };
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(2).height = 28;
  // ตัวแปรอัตราเงินเพิ่มที่ทุกแถวอ้างถึง
  ws.mergeCells(2, 10, 2, 11);
  ws.getCell(2, 10).value = 'อัตราเงินเพิ่ม/เดือน';
  ws.getCell(2, 10).font = { name: FONT, size: 10, bold: true };
  ws.getCell(2, 10).alignment = { horizontal: 'right', vertical: 'middle' };
  const rateCell = ws.getCell(2, 12);
  rateCell.value = 0.015;
  rateCell.numFmt = '0.0%';
  rateCell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
  fill(rateCell, INPUT_BG);
  rateCell.border = ALL_BORDERS;
  const RATE = '$L$2';

  headerRow(ws, 3, cols.map((c) => c.header), INDIGO);
  ws.getRow(3).height = 34;

  // เรียงจากเก่าไปใหม่ เพื่อให้อ่านเป็นลำดับเวลา
  const ordered = [...records].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  ordered.forEach((r, idx) => {
    const n = 4 + idx;
    const res = r.result;
    const notes = [r.penaltyRuleText];
    if (res.criminalFineApplies && res.criminalFine === 0) notes.push('ยังไม่รวมค่าปรับอาญา');
    if (r.estimate) notes.push(`ภาษีจากตัวช่วยคำนวณรายได้ (เงินได้สุทธิ ${r.estimate.netIncome.toLocaleString('en-US')} บาท)`);
    const values: any[] = [
      idx + 1,
      thaiDateTime(r.savedAt),
      r.label,
      r.taxTypeText,
      r.periodText,
      r.scenarioText,
      thaiDate(r.deadline),
      thaiDate(r.inputs.paymentDate),
      res.monthsLate,
      res.taxOwed,
      { formula: `ROUND(MIN(J${n}*${RATE}*I${n},J${n}),2)`, result: res.surcharge },
      res.penaltyMultiplier,
      res.penaltyDiscountPercent,
      { formula: `ROUND(ROUND(J${n}*L${n},2)*M${n}/100,2)`, result: res.penaltyReduced },
      res.criminalFine,
      { formula: `J${n}+K${n}+N${n}+O${n}`, result: res.totalToPay },
      notes.filter(Boolean).join(' / '),
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(n, i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 11, bold: i === 15 };
      cell.border = ALL_BORDERS;
      cell.alignment = { vertical: 'top', wrapText: i === 5 || i === 16 };
      if ([9, 10, 13, 14, 15].includes(i)) {
        cell.numFmt = MONEY;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
      }
      if ([8, 11, 12].includes(i)) cell.alignment = { horizontal: 'center', vertical: 'top' };
      if (i === 12) cell.numFmt = '0"%"';
      if (i === 11) cell.numFmt = '0.0';
      // ข้อมูลนำเข้า (แก้ได้) ใช้สีเหลือง
      if ([8, 9, 11, 12, 14].includes(i)) {
        fill(cell, INPUT_BG);
        cell.font = { name: FONT, size: 11, color: { argb: 'FF1D4ED8' } };
      }
    });
  });

  if (ordered.length > 0) {
    const sumRow = 4 + ordered.length;
    ws.mergeCells(sumRow, 1, sumRow, 9);
    ws.getCell(sumRow, 1).value = 'รวมทั้งหมด';
    ws.getCell(sumRow, 1).alignment = { horizontal: 'right' };
    const totals: Record<number, number> = {};
    ordered.forEach((r) => {
      const res = r.result;
      totals[10] = (totals[10] || 0) + res.taxOwed;
      totals[11] = (totals[11] || 0) + res.surcharge;
      totals[14] = (totals[14] || 0) + res.penaltyReduced;
      totals[15] = (totals[15] || 0) + res.criminalFine;
      totals[16] = (totals[16] || 0) + res.totalToPay;
    });
    [10, 11, 14, 15, 16].forEach((c) => {
      const col = String.fromCharCode(64 + c);
      const cell = ws.getCell(sumRow, c);
      cell.value = { formula: `SUM(${col}4:${col}${sumRow - 1})`, result: totals[c] };
      cell.numFmt = MONEY;
      cell.alignment = { horizontal: 'right' };
    });
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(sumRow, c);
      cell.font = { name: FONT, size: 11, bold: true };
      fill(cell, LIGHT);
      cell.border = ALL_BORDERS;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + ordered.length, column: lastCol } };
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buf = await wb.xlsx.writeBuffer();
  download(buf as ArrayBuffer, `ประวัติค่าปรับภาษี_${stamp()}.xlsx`);
}
