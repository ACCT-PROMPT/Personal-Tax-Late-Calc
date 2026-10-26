import type { HistoryRecord } from './history';
import { thaiDate, thaiDateTime } from './history';
import { LEGAL_BASIS } from './taxCalc';

// ExcelJS ค่อนข้างใหญ่ จึงโหลดเมื่อกดส่งออกเท่านั้น (ไม่ทำให้หน้าแรกช้า)
async function loadExcelJS() {
  const mod = await import('exceljs');
  return (mod as any).default ?? mod;
}

const FONT = 'Tahoma';
const MONEY = '#,##0.00';
const NAVY = 'FF1E1B4B';
const LIGHT = 'FFEEF2FF';
const BORDER = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

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

function itemNotes(r: HistoryRecord) {
  const res = r.result;
  const surchargeNote =
    res.monthsLate === 0
      ? 'ชำระทันกำหนด ไม่มีเงินเพิ่ม'
      : `1.5% ต่อเดือน × ${res.monthsLate} เดือน (ไม่เกินยอดภาษี)`;
  const penaltyNote =
    res.penaltyOriginal === 0
      ? 'ไม่มีเบี้ยปรับ'
      : `เบี้ยปรับตามกฎหมาย ${res.penaltyMultiplier} เท่า เหลือเสียจริง ${res.penaltyDiscountPercent}%`;
  const fineNote = !res.criminalFineApplies
    ? 'ไม่เข้าเงื่อนไข'
    : res.criminalFine > 0
      ? 'ตามที่สรรพากรแจ้ง'
      : 'ยังไม่รวมในยอด (ยังไม่ได้กรอกจำนวนที่สรรพากรแจ้ง)';
  return { surchargeNote, penaltyNote, fineNote };
}

// ---------------------------------------------------------------- ผลการคำนวณรายการเดียว
export async function exportRecordToExcel(r: HistoryRecord): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ระบบคิดค่าปรับภาษี';
  wb.created = new Date();
  const ws = wb.addWorksheet('สรุปผล', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 8 }, { width: 38 }, { width: 20 }, { width: 52 }];
  const base = { name: FONT, size: 11 };

  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value = `สรุปการคำนวณเบี้ยปรับและเงินเพิ่ม — ${r.taxTypeText}`;
  title.font = { name: FONT, size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `ออกรายงานเมื่อ ${thaiDateTime(new Date().toISOString())}${r.label ? `   |   อ้างอิง: ${r.label}` : ''}`;
  ws.getCell('A2').font = { name: FONT, size: 10, color: { argb: 'FF64748B' } };

  // ข้อมูลที่ใช้คำนวณ
  const info: [string, string | number][] = [
    ['ประเภทภาษี', r.taxTypeText],
    [r.kind === 'pit' ? 'ปีภาษี' : 'เดือนภาษี', r.periodText],
    ['ช่องทางการยื่นแบบ', r.methodText],
    ['ลักษณะการยื่น', r.scenarioText],
    ['วันครบกำหนดชำระ', thaiDate(r.deadline)],
    ['วันที่ชำระจริง / คาดว่าจะชำระ', thaiDate(r.inputs.paymentDate)],
    ['จำนวนเดือนที่ล่าช้า', r.result.monthsLate],
    ['เงื่อนไขเบี้ยปรับที่ใช้', r.penaltyRuleText],
  ];
  let row = 4;
  info.forEach(([k, v]) => {
    // คอลัมน์ B = หัวข้อ, C-D (รวมเซลล์) = ค่า
    ws.mergeCells(`C${row}:D${row}`);
    const kcell = ws.getCell(`B${row}`);
    kcell.value = k;
    kcell.font = { ...base, bold: true };
    kcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    kcell.border = ALL_BORDERS;
    const vcell = ws.getCell(`C${row}`);
    vcell.value = v;
    vcell.font = base;
    vcell.alignment = { horizontal: 'left', wrapText: true, vertical: 'top' };
    vcell.border = ALL_BORDERS;
    ws.getCell(`D${row}`).border = ALL_BORDERS;
    row++;
  });

  // ตารางรายการ
  row += 1;
  const headRow = row;
  ['ลำดับ', 'รายการ', 'จำนวนเงิน (บาท)', 'หมายเหตุ'].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { ...base, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = ALL_BORDERS;
  });
  row++;

  const n = itemNotes(r);
  const items: [number, string, number, string][] = [
    [1, 'ภาษีที่ค้างชำระ', r.result.taxOwed, 'ยอดภาษีที่จ่ายไม่ครบ/ที่ถูกประเมิน'],
    [2, r.kind === 'pit' ? 'เงินเพิ่ม (ม.27)' : 'เงินเพิ่ม (ม.89/1)', r.result.surcharge, n.surchargeNote],
    [3, r.kind === 'pit' ? 'เบี้ยปรับ (ม.22)' : 'เบี้ยปรับ (ม.89)', r.result.penaltyReduced, n.penaltyNote],
    [4, 'ค่าปรับอาญา', r.result.criminalFine, n.fineNote],
  ];
  const firstItem = row;
  items.forEach(([no, name, amount, note]) => {
    const c1 = ws.getCell(row, 1);
    c1.value = no;
    c1.alignment = { horizontal: 'center', vertical: 'top' };
    const c2 = ws.getCell(row, 2);
    c2.value = name;
    c2.alignment = { vertical: 'top' };
    const c3 = ws.getCell(row, 3);
    c3.value = amount;
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

  // ยอดรวมเป็นสูตร SUM จริง
  ws.getCell(row, 1).value = '';
  const tl = ws.getCell(row, 2);
  tl.value = 'ยอดรวมที่ต้องชำระ';
  const tv = ws.getCell(row, 3);
  tv.value = { formula: `SUM(C${firstItem}:C${lastItem})`, result: r.result.totalToPay };
  tv.numFmt = MONEY;
  tv.alignment = { horizontal: 'right' };
  ws.getCell(row, 4).value = r.result.criminalFineApplies && r.result.criminalFine === 0 ? 'ยังไม่รวมค่าปรับอาญา' : '';
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { name: FONT, size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    cell.border = ALL_BORDERS;
  }
  row += 2;

  if (r.result.penaltyOriginal > 0) {
    ws.getCell(row, 2).value = 'เบี้ยปรับเต็มตามกฎหมาย';
    ws.getCell(row, 3).value = r.result.penaltyOriginal;
    ws.getCell(row, 3).numFmt = MONEY;
    row++;
    ws.getCell(row, 2).value = 'ประหยัดเบี้ยปรับได้';
    ws.getCell(row, 3).value = r.result.penaltyOriginal - r.result.penaltyReduced;
    ws.getCell(row, 3).numFmt = MONEY;
    row++;
    [row - 2, row - 1].forEach((rr) => {
      ws.getCell(rr, 2).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
      ws.getCell(rr, 3).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
    });
    row++;
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
  // ใช้ headRow เพื่อให้หัวตารางค้างเมื่อพิมพ์หลายหน้า
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`;

  const buf = await wb.xlsx.writeBuffer();
  const name = safe(`${r.kind === 'pit' ? 'ภงด90-91' : 'ภพ30'}_${r.periodText}${r.label ? '_' + r.label : ''}`);
  download(buf as ArrayBuffer, `ค่าปรับภาษี_${name}_${stamp()}.xlsx`);
}

// ---------------------------------------------------------------- ประวัติทั้งหมด
export async function exportHistoryToExcel(records: HistoryRecord[]): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ระบบคิดค่าปรับภาษี';
  wb.created = new Date();
  const ws = wb.addWorksheet('ประวัติการคำนวณ', { views: [{ state: 'frozen', ySplit: 3 }] });

  const cols = [
    { header: 'ลำดับ', width: 8 },
    { header: 'บันทึกเมื่อ', width: 20 },
    { header: 'อ้างอิง / ชื่อลูกค้า', width: 26 },
    { header: 'ประเภทภาษี', width: 24 },
    { header: 'ปีภาษี / เดือนภาษี', width: 22 },
    { header: 'ลักษณะการยื่น', width: 36 },
    { header: 'วันครบกำหนด', width: 15 },
    { header: 'วันที่ชำระ', width: 15 },
    { header: 'ล่าช้า (เดือน)', width: 13 },
    { header: 'ภาษีที่ค้างชำระ', width: 18 },
    { header: 'เงินเพิ่ม', width: 16 },
    { header: 'เบี้ยปรับ', width: 16 },
    { header: 'ค่าปรับอาญา', width: 16 },
    { header: 'ยอดรวมที่ต้องชำระ', width: 20 },
    { header: 'หมายเหตุ', width: 40 },
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));

  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1);
  t.value = 'ประวัติการคำนวณเบี้ยปรับและเงินเพิ่ม';
  t.font = { name: FONT, size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, cols.length);
  ws.getCell(2, 1).value = `ออกรายงานเมื่อ ${thaiDateTime(new Date().toISOString())}   |   ทั้งหมด ${records.length} รายการ`;
  ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF64748B' } };

  cols.forEach((c, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = ALL_BORDERS;
  });
  ws.getRow(3).height = 24;

  // เรียงจากเก่าไปใหม่ในไฟล์ เพื่อให้อ่านเป็นลำดับเวลา
  const ordered = [...records].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  ordered.forEach((r, idx) => {
    const rowNo = 4 + idx;
    const n = itemNotes(r);
    const noteParts = [r.penaltyRuleText];
    if (r.result.criminalFineApplies && r.result.criminalFine === 0) noteParts.push('ยังไม่รวมค่าปรับอาญา');
    const values: (string | number)[] = [
      idx + 1,
      thaiDateTime(r.savedAt),
      r.label,
      r.taxTypeText,
      r.periodText,
      r.scenarioText,
      thaiDate(r.deadline),
      thaiDate(r.inputs.paymentDate),
      r.result.monthsLate,
      r.result.taxOwed,
      r.result.surcharge,
      r.result.penaltyReduced,
      r.result.criminalFine,
      0, // ใส่สูตรด้านล่าง
      noteParts.filter(Boolean).join(' / ') || n.penaltyNote,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(rowNo, i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 11 };
      cell.border = ALL_BORDERS;
      cell.alignment = { vertical: 'top', wrapText: i === 5 || i === 14 };
      if (i >= 9 && i <= 13) {
        cell.numFmt = MONEY;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
      }
      if (i === 0 || i === 8) cell.alignment = { horizontal: 'center', vertical: 'top' };
    });
    // ยอดรวมต่อแถวเป็นสูตร (ภาษี + เงินเพิ่ม + เบี้ยปรับ + ค่าปรับอาญา)
    const tot = ws.getCell(rowNo, 14);
    tot.value = { formula: `SUM(J${rowNo}:M${rowNo})`, result: r.result.totalToPay };
    tot.font = { name: FONT, size: 11, bold: true };
  });

  if (ordered.length > 0) {
    const sumRow = 4 + ordered.length;
    ws.getCell(sumRow, 1).value = '';
    ws.mergeCells(sumRow, 1, sumRow, 9);
    ws.getCell(sumRow, 1).value = 'รวมทั้งหมด';
    ws.getCell(sumRow, 1).alignment = { horizontal: 'right' };
    for (let c = 10; c <= 14; c++) {
      const col = String.fromCharCode(64 + c);
      const cell = ws.getCell(sumRow, c);
      const total = ordered.reduce((s, r) => {
        const res = r.result;
        const map: Record<number, number> = {
          10: res.taxOwed,
          11: res.surcharge,
          12: res.penaltyReduced,
          13: res.criminalFine,
          14: res.totalToPay,
        };
        return s + map[c];
      }, 0);
      cell.value = { formula: `SUM(${col}4:${col}${sumRow - 1})`, result: total };
      cell.numFmt = MONEY;
      cell.alignment = { horizontal: 'right' };
    }
    for (let c = 1; c <= cols.length; c++) {
      const cell = ws.getCell(sumRow, c);
      cell.font = { name: FONT, size: 11, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      cell.border = ALL_BORDERS;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + ordered.length, column: cols.length } };
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buf = await wb.xlsx.writeBuffer();
  download(buf as ArrayBuffer, `ประวัติค่าปรับภาษี_${stamp()}.xlsx`);
}
