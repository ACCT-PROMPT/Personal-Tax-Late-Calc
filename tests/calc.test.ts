// รันด้วย: npm test
// ตัวเลขคาดหวังคำนวณมือจากกฎ (ไม่ได้ copy จากผลของโค้ด) และตัวอย่างสูตรจากหน้า "ตัวอย่างการคำนวณเบี้ยปรับและเงินเพิ่ม ภ.พ.30" ของกรมสรรพากร
import test from 'node:test';
import assert from 'node:assert/strict';
import { FilingMethod, FilingScenario, PenaltyReduction } from '../src/types';
import {
  TAX_YEARS,
  calculateMonthsLate,
  calculateProgressiveTax,
  calculateTaxPenalties,
  calculateVatPenalties,
  vatVoluntaryPenaltyPercent,
} from '../src/utils/taxCalc';
import {
  IncomeLine,
  emptyAllowances,
  estimateIncomeTax,
  newLineId,
} from '../src/utils/incomeTax';

const line = (kind: IncomeLine['kind'], amount: number, extra: Partial<IncomeLine> = {}): IncomeLine => ({
  id: newLineId(), kind, amount, sub: '', actual: false, actualExpense: 0, ...extra,
});
const est = (lines: IncomeLine[], allowances = emptyAllowances(), withheld = 0, prepaid = 0) =>
  estimateIncomeTax({ lines, allowances, withheld, prepaid });

// ------------------------------------------------------------ ภาษีเงินได้: อัตราก้าวหน้า
test('อัตราก้าวหน้า ณ จุดแบ่งขั้น', () => {
  const cases: [number, number][] = [
    [150000, 0], [150100, 5], [300000, 7500], [500000, 27500],
    [750000, 65000], [1000000, 115000], [2000000, 365000], [5000000, 1265000], [6000000, 1615000],
  ];
  for (const [net, tax] of cases) assert.equal(calculateProgressiveTax(net).totalTax, tax, `net ${net}`);
});

// ------------------------------------------------------------ ตัวประเมินภาษีตามประเภทเงินได้
test('เงินเดือนอย่างเดียว 480,000: หักเหมา 100,000 (เพดาน) ลดหย่อน 60,000 -> เงินได้สุทธิ 320,000 ภาษี 9,500', () => {
  const r = est([line('salary', 480000)]);
  assert.equal(r.totalExpenses, 100000);
  assert.equal(r.netIncome, 320000);
  assert.equal(r.taxTotal, 9500);
});

test('ฟรีแลนซ์ 40(2) 600,000: หักเหมา 50% แต่ไม่เกิน 100,000 -> สุทธิ 440,000 ภาษี 21,500', () => {
  const r = est([line('freelance', 600000)]);
  assert.equal(r.totalExpenses, 100000);
  assert.equal(r.netIncome, 440000);
  assert.equal(r.taxTotal, 21500);
});

test('ขายของออนไลน์ 40(8) 1,000,000 หักเหมา 60% -> สุทธิ 340,000 ภาษี 11,500 (ภาษีขั้นต่ำ 5,000 ต่ำกว่า จึงไม่ใช้)', () => {
  const r = est([line('business', 1000000, { sub: 'r60' })]);
  assert.equal(r.netIncome, 340000);
  assert.equal(r.progressiveTax, 11500);
  assert.equal(r.minTax, 5000);
  assert.equal(r.minTaxApplies, false);
  assert.equal(r.taxTotal, 11500);
});

test('เงินเดือน 480,000 + ขายของ 200,000 (60%): ค่าใช้จ่าย 100,000 + 120,000 -> สุทธิ 400,000 ภาษี 17,500', () => {
  const r = est([line('salary', 480000), line('business', 200000, { sub: 'r60' })]);
  assert.equal(r.totalExpenses, 220000);
  assert.equal(r.netIncome, 400000);
  assert.equal(r.taxTotal, 17500);
});

test('40(1)+(2) แชร์เพดานหักเหมา 100,000 ร่วมกัน', () => {
  const r = est([line('salary', 80000), line('freelance', 120000)]);
  // 50% = 40,000 + 60,000 = 100,000 พอดี
  assert.equal(r.totalExpenses, 100000);
  const big = est([line('salary', 400000), line('freelance', 400000)]);
  assert.equal(big.totalExpenses, 100000);
});

test('ภาษีขั้นต่ำ 0.5%: ธุรกิจ 1,000,000 หักตามจริง 950,000 -> ภาษีปกติ 0 แต่ต้องเสียขั้นต่ำ 5,000', () => {
  const r = est([line('business', 1000000, { actual: true, actualExpense: 950000 })]);
  assert.equal(r.progressiveTax, 0);
  assert.equal(r.minTaxApplies, true);
  assert.equal(r.taxTotal, 5000);
});

test('ภาษีขั้นต่ำไม่ใช้ถ้าเงินได้ 40(2)-(8) รวมไม่ถึง 120,000', () => {
  const r = est([line('business', 119999, { actual: true, actualExpense: 119999 })]);
  assert.equal(r.minTax, 0);
  assert.equal(r.taxTotal, 0);
});

test('ค่าเช่าบ้าน 288,000/ปี หักเหมา 30% -> ภาษีปกติ 0 แต่ขั้นต่ำ 1,440', () => {
  const r = est([line('rent', 288000, { sub: 'building' })]);
  assert.equal(r.totalExpenses, 86400);
  assert.equal(r.progressiveTax, 0);
  assert.equal(r.taxTotal, 1440);
});

test('อัตราหักเหมาตามชนิด: เช่าที่ดินเกษตร 20%, วิชาชีพแพทย์ 60%, วิชาชีพอื่น 30%, รับเหมา 60%, ดอกเบี้ยไม่หัก', () => {
  assert.equal(est([line('rent', 100000, { sub: 'farmland' })]).totalExpenses, 20000);
  assert.equal(est([line('profession', 100000, { sub: 'medical' })]).totalExpenses, 60000);
  assert.equal(est([line('profession', 100000, { sub: 'other' })]).totalExpenses, 30000);
  assert.equal(est([line('contract', 100000)]).totalExpenses, 60000);
  assert.equal(est([line('interest', 100000)]).totalExpenses, 0);
});

test('ค่าลดหย่อนใช้เพดานครบ: ชุดตัวอย่างเงินเดือน 1,200,000 -> ภาษี 54,650', () => {
  const a = emptyAllowances();
  a.spouse = true; a.childrenFirst = 1; a.parents = 2;
  a.socialSecurity = 10000; // เพดาน 9,000
  a.lifeInsurance = 120000; a.ownHealthInsurance = 30000; // รวมไม่เกิน 100,000
  a.homeLoanInterest = 150000; // เพดาน 100,000
  const r = est([line('salary', 1200000)], a);
  // 60,000 + 60,000 + 30,000 + 60,000 + 9,000 + 100,000 + 100,000 = 419,000
  assert.equal(r.totalAllowances, 419000);
  assert.equal(r.netIncome, 681000);
  assert.equal(r.taxTotal, 54650);
});

test('ภาษีที่จ่ายไปแล้ว: ต้องจ่ายเพิ่ม และกรณีจ่ายเกินเป็นยอดขอคืน', () => {
  const owe = est([line('salary', 480000)], emptyAllowances(), 5000, 1000);
  assert.equal(owe.additionalTax, 3500);
  assert.equal(owe.refund, 0);
  const refund = est([line('salary', 480000)], emptyAllowances(), 12000, 0);
  assert.equal(refund.additionalTax, 0);
  assert.equal(refund.refund, 2500);
});

// ------------------------------------------------------------ เงินเพิ่ม / เบี้ยปรับ
test('นับเดือนล่าช้า (เศษของเดือนนับเป็น 1 เดือน)', () => {
  assert.equal(calculateMonthsLate('2026-04-08', '2026-04-08'), 0);
  assert.equal(calculateMonthsLate('2026-04-08', '2026-04-09'), 1);
  assert.equal(calculateMonthsLate('2026-04-08', '2026-05-08'), 1);
  assert.equal(calculateMonthsLate('2026-04-08', '2026-05-09'), 2);
  assert.equal(calculateMonthsLate('2026-04-08', '2026-06-29'), 3);
});

test('ภ.ง.ด.: ยื่นเอง ช้า 3 เดือน เงินเพิ่ม 4.5% ไม่มีเบี้ยปรับ', () => {
  const p = calculateTaxPenalties(5000, 2568, FilingMethod.ONLINE, FilingScenario.VOLUNTARY, PenaltyReduction.NO_REDUCTION, '2026-06-29', 1000);
  assert.equal(p.monthsLate, 3);
  assert.equal(p.surcharge, 225);
  assert.equal(p.penaltyReduced, 0);
  assert.equal(p.criminalFine, 1000);
  assert.equal(p.totalToPay, 6225);
});

test('ภ.ง.ด.: ถูกประเมิน ไม่ยื่นเลย เบี้ยปรับ 2 เท่า ลดเหลือ 50%; ค่าปรับอาญาไม่เกิน 2,000', () => {
  const p = calculateTaxPenalties(5000, 2568, FilingMethod.ONLINE, FilingScenario.ASSESSED_NOT_FILED, PenaltyReduction.REDUCED_50, '2026-06-29', 5000);
  assert.equal(p.penaltyOriginal, 10000);
  assert.equal(p.penaltyReduced, 5000);
  assert.equal(p.criminalFine, 2000);
});

test('วันที่ยื่นแบบแยกจากวันที่ชำระ: ยื่นทันแต่ชำระช้า มีเงินเพิ่มแต่ไม่เข้าเงื่อนไขค่าปรับอาญา', () => {
  const onTime = calculateTaxPenalties(5000, 2568, FilingMethod.ONLINE, FilingScenario.VOLUNTARY, PenaltyReduction.NO_REDUCTION, '2026-06-29', 1000, '2026-04-08');
  assert.equal(onTime.surcharge, 225);
  assert.equal(onTime.criminalFineApplies, false);
  assert.equal(onTime.criminalFine, 0);
  const late = calculateTaxPenalties(5000, 2568, FilingMethod.ONLINE, FilingScenario.VOLUNTARY, PenaltyReduction.NO_REDUCTION, '2026-06-29', 1000, '2026-04-20');
  assert.equal(late.criminalFineApplies, true);
  assert.equal(late.criminalFine, 1000);
});

test('ไม่มีภาษีต้องจ่าย (ขอคืน) แต่ยื่นช้า: ไม่มีเงินเพิ่ม แต่ยังเข้าเงื่อนไขค่าปรับอาญา', () => {
  const p = calculateTaxPenalties(0, 2568, FilingMethod.ONLINE, FilingScenario.VOLUNTARY, PenaltyReduction.NO_REDUCTION, '2026-06-29', 500, '2026-06-29');
  assert.equal(p.surcharge, 0);
  assert.equal(p.criminalFineApplies, true);
  assert.equal(p.criminalFine, 500);
});

test('วันครบกำหนดที่กำหนดเอง (กรณีขยายเวลา) ใช้แทนค่าที่ตั้งไว้', () => {
  const p = calculateTaxPenalties(5000, 2568, FilingMethod.ONLINE, FilingScenario.VOLUNTARY, PenaltyReduction.NO_REDUCTION, '2026-06-29', 0, undefined, '2026-05-31');
  assert.equal(p.monthsLate, 1);
  assert.equal(p.surcharge, 75);
});

test('กำหนดยื่นปีภาษี 2566 แบบกระดาษ = 1 เม.ย. 2567 (31 มี.ค. เป็นวันอาทิตย์)', () => {
  assert.equal(TAX_YEARS.find((y) => y.yearTh === 2566)!.paperDeadline, '2024-04-01');
});

test('ภ.พ.30: ตารางลดเบี้ยปรับยื่นเอง 2/5/10/20% ตามจำนวนวันที่ช้า', () => {
  assert.deepEqual([0, 1, 15, 16, 30, 31, 60, 61].map(vatVoluntaryPenaltyPercent), [0, 2, 2, 5, 5, 10, 10, 20]);
});

test('ภ.พ.30: ยื่นเพิ่มเติมเอง (1 เท่า) ช้า 12 วัน -> 2% ของเบี้ยปรับ', () => {
  const v = calculateVatPenalties(10000, 5, 2568, FilingMethod.ONLINE, 'voluntary_additional', '2025-07-05');
  assert.equal(v.deadlineDate, '2025-06-23');
  assert.equal(v.penaltyDiscountPercent, 2);
  assert.equal(v.penaltyReduced, 200);
  assert.equal(v.surcharge, 150);
});

test('ภ.พ.30: ยื่นล่าช้า (2 เท่า) ช้า 48 วัน -> 10% ของ 20,000 = 2,000 (20% ของภาษี)', () => {
  const v = calculateVatPenalties(10000, 5, 2568, FilingMethod.ONLINE, 'voluntary_late', '2025-08-10');
  assert.equal(v.penaltyOriginal, 20000);
  assert.equal(v.penaltyReduced, 2000);
});

test('ภ.พ.30: ถูกประเมิน ไม่ลด / 40% / 50%', () => {
  const run = (r: 'NONE' | 'PCT_40' | 'PCT_50') =>
    calculateVatPenalties(10000, 5, 2568, FilingMethod.ONLINE, 'assessed_not_filed', '2025-09-21', 0, r).penaltyReduced;
  assert.deepEqual([run('NONE'), run('PCT_40'), run('PCT_50')], [20000, 8000, 10000]);
});

test('ภ.พ.30: ตัวคูณเบี้ยปรับตามหนังสือประเมิน (override) ใช้แทนค่าตามลักษณะ', () => {
  const v = calculateVatPenalties(10000, 5, 2568, FilingMethod.ONLINE, 'voluntary_late', '2025-08-10', 0, 'NONE', undefined, undefined, 1);
  assert.equal(v.penaltyMultiplier, 1);
  assert.equal(v.penaltyOriginal, 10000);
});

// ตัวอย่างจากกรมสรรพากร (rd.go.th/9880): ตัวอย่าง 1.1 ภาษี 250 เบี้ยปรับ ม.89(2) 2 เท่า = 500; ตัวอย่าง 5 เงินเพิ่ม 1,300 × 1.5% ต่อเดือน
test('ตัวอย่างทางการ: เบี้ยปรับ 2 เท่าของ 250 = 500 และเงินเพิ่ม 1,300 × 1.5% = 19.50 ต่อเดือน', () => {
  const ex11 = calculateVatPenalties(250, 5, 2568, FilingMethod.ONLINE, 'assessed_not_filed', '2025-07-10', 0, 'NONE');
  assert.equal(ex11.penaltyOriginal, 500);
  assert.equal(ex11.penaltyReduced, 500);
  const ex5 = calculateVatPenalties(1300, 5, 2568, FilingMethod.ONLINE, 'voluntary_additional', '2025-07-10');
  assert.equal(ex5.monthsLate, 1);
  assert.equal(ex5.surcharge, 19.5);
});

test('ปัดเศษเป็นสตางค์และยอดรวมตรงกับผลรวมของรายการ', () => {
  const v = calculateVatPenalties(1234567.89, 5, 2568, FilingMethod.ONLINE, 'voluntary_late', '2025-08-10', 500);
  const sum = Math.round((v.taxOwed + v.surcharge + v.penaltyReduced + v.criminalFine) * 100) / 100;
  assert.equal(v.totalToPay, sum);
  for (const n of [v.surcharge, v.penaltyOriginal, v.penaltyReduced]) assert.equal(Math.round(n * 100) / 100, n);
});

test('เงินเพิ่มไม่เกินยอดภาษี (เพดาน 100%)', () => {
  const v = calculateVatPenalties(1000, 1, 2560, FilingMethod.ONLINE, 'voluntary_additional', '2026-06-29');
  assert.equal(v.surcharge, 1000);
});
