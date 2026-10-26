import {
  FilingMethod,
  FilingScenario,
  PenaltyReduction,
  VatAssessedReduction,
  TaxYearConfig,
  CalculationResult,
  IncomeEstimation,
} from '../types';

// กำหนดปฏิทินวันสิ้นสุดการยื่นภาษีของแต่ละปีภาษี (ปกติยื่นในปีถัดไป)
export const TAX_YEARS: TaxYearConfig[] = [
  {
    yearTh: 2568,
    yearEn: 2025,
    paperDeadline: '2026-03-31',
    onlineDeadline: '2026-04-08',
  },
  {
    yearTh: 2567,
    yearEn: 2024,
    paperDeadline: '2025-03-31',
    onlineDeadline: '2025-04-08',
  },
  {
    yearTh: 2566,
    yearEn: 2023,
    paperDeadline: '2024-04-01', // 31 มี.ค. 2567 เป็นวันอาทิตย์ เลื่อนเป็นวันทำการถัดไป
    onlineDeadline: '2024-04-09', // วันที่ 8 เป็นวันหยุดชดเชยจักรี เลื่อนเป็นวันที่ 9
  },
  {
    yearTh: 2565,
    yearEn: 2022,
    paperDeadline: '2023-03-31',
    onlineDeadline: '2023-04-10', // วันที่ 8-9 เป็นวันเสาร์อาทิตย์ เลื่อนเป็นวันที่ 10
  }
];

// แหล่งอ้างอิงกฎหมายที่ใช้ในตารางลดเบี้ยปรับ (ตรวจสอบกับเว็บกรมสรรพากรเมื่อ 26 ต.ค. 2569)
export const LEGAL_BASIS = {
  directive: 'คำสั่งกรมสรรพากร ที่ ท.ป. 81/2542 (แก้ไขโดย ท.ป. 369/2569 มีผลตั้งแต่ 3 ก.ค. 2569)',
  url: 'https://www.rd.go.th/3361.html',
  checkedOn: '26 ต.ค. 2569',
} as const;

// เพดานค่าปรับอาญากรณีไม่ยื่น/ยื่นแบบ ภ.ง.ด.ล่าช้า ตามมาตรา 35 แห่งประมวลรัษฎากร
export const PIT_CRIMINAL_FINE_MAX = 2000;

// ปัดเศษเป็นสตางค์ (2 ตำแหน่ง) ให้ยอดรวมตรงกับผลรวมของรายการที่แสดง และตรงกับใน Excel
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ค่าปรับอาญา = จำนวนที่ผู้ใช้กรอกตามที่สรรพากรแจ้ง (ไม่กรอกถือเป็น 0) ไม่เกินเพดาน (ถ้ามี)
function resolveCriminalFine(applies: boolean, entered: number, max: number | null): number {
  if (!applies || !(entered > 0)) return 0;
  return max === null ? entered : Math.min(entered, max);
}

// คำนวณจำนวนเดือนที่ล่าช้า (เศษของเดือนปัดเป็น 1 เดือน)
export function calculateMonthsLate(deadlineStr: string, paymentDateStr: string): number {
  const deadline = new Date(deadlineStr);
  const paymentDate = new Date(paymentDateStr);

  // ตั้งค่าเป็น 00:00:00 เพื่อเปรียบเทียบเฉพาะวันที่
  deadline.setHours(0, 0, 0, 0);
  paymentDate.setHours(0, 0, 0, 0);

  if (paymentDate <= deadline) {
    return 0;
  }

  // วันแรกที่เริ่มนับเงินเพิ่ม (วันถัดไปจากวันสิ้นสุดการยื่นแบบ)
  const startCountingDate = new Date(deadline);
  startCountingDate.setDate(deadline.getDate() + 1);

  let months = 1;
  const currentCheckDate = new Date(startCountingDate);

  // วนลูปเพื่อคำนวณเดือนแบบครบลูป "ชนวัน"
  // กรมสรรพากรนับ: สมมติกำหนด 8 เม.ย. เริ่มนับ 9 เม.ย.
  // 9 เม.ย. - 8 พ.ค. = เดือนที่ 1 (จ่ายวันที่ 9 เม.ย. ก็ปัดเป็น 1 เดือน, จ่าย 8 พ.ค. ก็ 1 เดือน)
  // 9 พ.ค. - 8 มิ.ย. = เดือนที่ 2 (จ่าย 9 พ.ค. ปัดเป็น 2 เดือน)
  while (true) {
    // เพิ่มขึ้น 1 เดือนล่วงหน้า เพื่อหาจุดสิ้นสุดของเดือนปัจจุบัน
    const nextCheckDate = new Date(currentCheckDate);
    nextCheckDate.setMonth(currentCheckDate.getMonth() + 1);
    
    // ชนวันของเดือนถัดไป ลบออก 1 วัน
    nextCheckDate.setDate(nextCheckDate.getDate() - 1);

    if (paymentDate <= nextCheckDate) {
      break;
    }

    months++;
    // เลื่อนวันที่เริ่มต้นเช็คไปยังรอบถัดไป (เช่น จาก 9 พ.ค.)
    currentCheckDate.setMonth(currentCheckDate.getMonth() + 1);
  }

  return months;
}

// คำนวณค่าปรับทางภาษีทั้งหมด
export function calculateTaxPenalties(
  taxOwed: number,
  taxYearTh: number,
  method: FilingMethod,
  scenario: FilingScenario,
  reduction: PenaltyReduction,
  paymentDateStr: string,
  criminalFineEntered: number = 0
): CalculationResult {
  const yearConfig = TAX_YEARS.find(y => y.yearTh === taxYearTh) || TAX_YEARS[0];
  const deadlineStr = method === FilingMethod.ONLINE ? yearConfig.onlineDeadline : yearConfig.paperDeadline;

  // 1. คำนวณเดือนล่าช้า
  const monthsLate = calculateMonthsLate(deadlineStr, paymentDateStr);

  // 2. ค่าปรับอาญา (ม. 35 ไม่เกิน 2,000 บาท) กรมสรรพากรไม่ได้ประกาศตารางตายตัว
  //    จึงใช้จำนวนที่ผู้ใช้กรอกตามที่สรรพากรแจ้ง (ไม่กรอก = 0 และแจ้งเตือนว่ายังไม่รวมในยอด)
  const criminalFineApplies = scenario !== FilingScenario.VOLUNTARY || monthsLate > 0;
  const criminalFine = resolveCriminalFine(criminalFineApplies, criminalFineEntered, PIT_CRIMINAL_FINE_MAX);

  // 3. คำนวณเงินเพิ่ม (Surcharge) - 1.5% ต่อเดือนของภาษีที่ต้องชำระ (เศษของเดือนปัดเป็น 1 เดือน)
  // และไม่เกินตัวเงินภาษีที่ค้างชำระ
  let surcharge = 0;
  if (taxOwed > 0 && monthsLate > 0) {
    const calculatedSurcharge = taxOwed * 0.015 * monthsLate;
    surcharge = round2(Math.min(calculatedSurcharge, taxOwed)); // ห้ามเกินจำนวนเงินภาษีที่ค้างชำระ
  }

  // 4. คำนวณเบี้ยปรับ (Penalty)
  let penaltyMultiplier = 0;
  if (scenario === FilingScenario.ASSESSED_INCORRECT) {
    penaltyMultiplier = 1.0; // ยื่นไว้ไม่ครบ โดน 1 เท่า
  } else if (scenario === FilingScenario.ASSESSED_NOT_FILED) {
    penaltyMultiplier = 2.0; // ไม่ได้ยื่นแบบเลย โดน 2 เท่า
  }

  const penaltyOriginal = round2(taxOwed * penaltyMultiplier);

  // เปอร์เซ็นต์ของเบี้ยปรับที่ต้องจ่ายจริง
  // ท.ป. 81/2542 ข้อ 4: ลดได้ตามดุลพินิจแต่ต้องเสียไม่น้อยกว่า 50% (ไม่มีตารางตามช่วงวัน)
  let penaltyDiscountPercent = 100;
  if (scenario === FilingScenario.VOLUNTARY) {
    penaltyDiscountPercent = 0; // ยื่นเองไม่มีเบี้ยปรับ
  } else if (reduction === PenaltyReduction.REDUCED_50) {
    penaltyDiscountPercent = 50;
  }

  const penaltyReduced = round2((penaltyOriginal * penaltyDiscountPercent) / 100);

  // 5. สรุปยอดรวม
  const totalPenaltiesAndSurcharges = round2(criminalFine + surcharge + penaltyReduced);
  const totalToPay = round2(taxOwed + totalPenaltiesAndSurcharges);

  return {
    taxOwed,
    monthsLate,
    criminalFine,
    criminalFineApplies,
    criminalFineMax: PIT_CRIMINAL_FINE_MAX,
    surcharge,
    penaltyOriginal,
    penaltyReduced,
    penaltyMultiplier,
    penaltyDiscountPercent,
    totalToPay,
    totalPenaltiesAndSurcharges,
  };
}

// โครงสร้างคำนวณภาษีเงินได้บุคคลธรรมดาแบบก้าวหน้า (Progressive Tax Brackets 2560 - ปัจจุบัน)
export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export const THAI_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 150000, rate: 0.00 },       // 0 - 150,000 ได้รับยกเว้น
  { min: 150001, max: 300000, rate: 0.05 },  // 150,001 - 300,000 (5%)
  { min: 300001, max: 500000, rate: 0.10 },  // 300,001 - 500,000 (10%)
  { min: 500001, max: 750000, rate: 0.15 },  // 500,001 - 750,000 (15%)
  { min: 750001, max: 1000000, rate: 0.20 }, // 750,001 - 1,000,000 (20%)
  { min: 1000001, max: 2000000, rate: 0.25 },// 1,000,001 - 2,000,000 (25%)
  { min: 2000001, max: 5000000, rate: 0.30 },// 2,000,001 - 5,000,000 (30%)
  { min: 5000001, max: Infinity, rate: 0.35 } // เกิน 5,000,000 (35%)
];

// คำนวณหาภาษีที่ต้องเสียจากเงินได้สุทธิ
export function calculateProgressiveTax(netIncome: number): {
  totalTax: number;
  bracketBreakdown: { bracketName: string; incomeInBracket: number; rate: number; tax: number }[];
} {
  let remainingIncome = Math.max(0, netIncome);
  let totalTax = 0;
  const bracketBreakdown: { bracketName: string; incomeInBracket: number; rate: number; tax: number }[] = [];

  for (const bracket of THAI_TAX_BRACKETS) {
    // ช่วงแรกเริ่มที่ 0 (ไม่ใช่ 1) จึงกว้าง 150,000 พอดี ช่วงถัดไปเริ่มที่ min-1 (เช่น 150,001 = เกิน 150,000)
    const lowerBound = bracket.min === 0 ? 0 : bracket.min - 1;
    const rangeSize = bracket.max - lowerBound;
    let incomeInBracket = 0;

    if (remainingIncome > 0) {
      if (bracket.max === Infinity) {
        incomeInBracket = remainingIncome;
      } else {
        incomeInBracket = Math.min(remainingIncome, rangeSize);
      }
      remainingIncome -= incomeInBracket;
    }

    const taxInBracket = incomeInBracket * bracket.rate;
    totalTax += taxInBracket;

    // ตั้งชื่อช่วงสำหรับภาษาไทยให้ดูง่าย
    let bracketName = '';
    if (bracket.min === 0) {
      bracketName = `0 - 150,000`;
    } else if (bracket.max === Infinity) {
      bracketName = `มากกว่า ${bracket.min.toLocaleString()}`;
    } else {
      bracketName = `${bracket.min.toLocaleString()} - ${bracket.max.toLocaleString()}`;
    }

    bracketBreakdown.push({
      bracketName,
      incomeInBracket,
      rate: bracket.rate,
      tax: taxInBracket,
    });

    if (remainingIncome <= 0) {
      // นำเสนอแบร็กเก็ตที่เหลืออยู่เพื่อเติมกราฟหรือตารางให้ครบ
      continue;
    }
  }

  return {
    totalTax: Math.round(totalTax),
    bracketBreakdown,
  };
}

// คำนวณประเมินรายได้และภาษีขาด (Income Estimation Helper)
export function estimateMissingTax(est: IncomeEstimation): {
  assessableIncome: number;
  deductibleExpenses: number;
  deductibleAllowances: number;
  netIncome: number;
  estimatedTaxTotal: number;
  estimatedAdditionalTaxNeeded: number;
} {
  const assessableIncome = est.income40_1 + est.incomeOther;

  // 1. หักค่าใช้จ่ายสำหรับเงินเดือน 40(1) (หักเหมา 50% ไม่เกิน 100,000 บาท)
  let deductibleExpenses = 0;
  if (est.expenseMethod === 'standard') {
    deductibleExpenses = Math.min(est.income40_1 * 0.5, 100000);
    // กรณีมีรายได้อื่นๆ ก็คำนวณหักแบบเหมา (สมมติหักเหมาทั่วไป 60% หรือให้กรอกตามจริง)
    // เพื่อความง่ายและแม่นยำ ให้ผู้ใช้กรอก Expenses ส่วนเพิ่มเติมเอง หรือหักตามจริง
    deductibleExpenses += est.expenses;
  } else {
    deductibleExpenses = est.expenses;
  }

  // 2. หักค่าลดหย่อน
  // ค่าลดหย่อนส่วนตัว: ใช้ค่าที่รับเข้ามา (ค่าเริ่มต้น 60,000 บาท) ไม่ล็อกค่าคงที่
  const personalAllowance = Number.isFinite(est.personalAllowance) ? est.personalAllowance : 60000;
  const deductibleAllowances = personalAllowance + est.otherAllowances;

  // 3. คำนวณเงินได้สุทธิ
  const netIncome = Math.max(0, assessableIncome - deductibleExpenses - deductibleAllowances);

  // 4. คำนวณภาษี
  const { totalTax } = calculateProgressiveTax(netIncome);

  // 5. ภาษีที่จ่ายไม่ครบ = ภาษีที่คำนวณได้ - ภาษีที่หัก/จ่ายไว้แล้ว
  const estimatedAdditionalTaxNeeded = Math.max(0, totalTax - est.taxAlreadyPaid);

  return {
    assessableIncome,
    deductibleExpenses,
    deductibleAllowances,
    netIncome,
    estimatedTaxTotal: totalTax,
    estimatedAdditionalTaxNeeded,
  };
}

// === โหมดคำนวณภาษีมูลค่าเพิ่ม (VAT - ภ.พ.30) ===

export interface VatCalculationResult {
  taxOwed: number;
  monthsLate: number;
  deadlineDate: string;
  criminalFine: number; // ตามจำนวนที่ผู้ใช้กรอกจากที่สรรพากรแจ้ง (ไม่กรอก = 0)
  criminalFineApplies: boolean; // ล่าช้า/ถูกประเมิน จึงอาจต้องเสียค่าปรับอาญา
  criminalFineMax: number | null; // ภ.พ.30 ไม่มีเพดานอ้างอิงที่ยืนยันได้
  surcharge: number;
  penaltyOriginal: number; // เบี้ยปรับตามกฎหมายเต็มจำนวน (1 หรือ 2 เท่าของภาษี)
  penaltyReduced: number;
  penaltyMultiplier: number; // เบี้ยปรับตามกฎหมาย กี่เท่าของภาษี
  // % ของ "เบี้ยปรับตามกฎหมาย" ที่ต้องเสียหลังลด (ท.ป. 81/2542 ข้อ 5) ไม่ใช่ % ของภาษี
  penaltyDiscountPercent: number;
  penaltyPercentApplied: number; // ชื่อเดิม = penaltyDiscountPercent
  totalToPay: number;
  totalPenaltiesAndSurcharges: number;
}

// ฟังก์ชันหาดีดไลน์ของ VAT (ภ.พ.30) รายเดือน
// ภ.พ.30 ของเดือน M ต้องยื่นภายในวันที่ 15 (กระดาษ) หรือ 23 (ออนไลน์) ของเดือน M+1
export function getVatDeadline(month: number, yearTh: number, method: FilingMethod): string {
  const yearEn = yearTh - 543;
  let deadlineMonth = month;
  let deadlineYear = yearEn;

  if (deadlineMonth === 12) {
    deadlineMonth = 1;
    deadlineYear = yearEn + 1;
  } else {
    deadlineMonth = deadlineMonth + 1;
  }

  const day = method === FilingMethod.ONLINE ? 23 : 15;
  const monthStr = deadlineMonth.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');

  return `${deadlineYear}-${monthStr}-${dayStr}`;
}

// ตารางลดเบี้ยปรับ ภ.พ.30 กรณียื่นแบบพร้อมชำระเองโดยไม่ได้รับคำเตือน (ท.ป. 81/2542 ข้อ 5(1))
// นับจากวันพ้นกำหนดชำระ: ไม่เกิน 15 วัน 2%, 16-30 วัน 5%, 31-60 วัน 10%, เกิน 60 วัน 20% ของเบี้ยปรับตามกฎหมาย
export function vatVoluntaryPenaltyPercent(daysLate: number): number {
  if (daysLate <= 0) return 0; // ยื่นและชำระทันกำหนด ไม่มีเบี้ยปรับ
  if (daysLate <= 15) return 2;
  if (daysLate <= 30) return 5;
  if (daysLate <= 60) return 10;
  return 20;
}

// ถูกประเมิน: ข้อ 5(2)-(3) ลดเหลือ 40% หรือ 50% ของเบี้ยปรับ (ดุลพินิจเจ้าพนักงาน) ไม่ลด = 100%
const VAT_ASSESSED_PERCENT: Record<VatAssessedReduction, number> = {
  NONE: 100,
  PCT_40: 40,
  PCT_50: 50,
};

// คำนวณเบี้ยปรับ เงินเพิ่ม และค่าปรับอาญาของ VAT (ภ.พ.30)
export function calculateVatPenalties(
  taxOwed: number,
  month: number,
  yearTh: number,
  method: FilingMethod,
  scenario: 'voluntary_additional' | 'voluntary_late' | 'assessed_incorrect' | 'assessed_not_filed',
  paymentDateStr: string,
  criminalFineEntered: number = 0,
  assessedReduction: VatAssessedReduction = 'NONE'
): VatCalculationResult {
  const deadlineDate = getVatDeadline(month, yearTh, method);
  const monthsLate = calculateMonthsLate(deadlineDate, paymentDateStr);

  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);
  const paymentDate = new Date(paymentDateStr);
  paymentDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((paymentDate.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

  const isAssessed = scenario === 'assessed_incorrect' || scenario === 'assessed_not_filed';

  // 1. ค่าปรับทางอาญา: ไม่มีตารางตายตัวที่ยืนยันได้ จึงใช้จำนวนที่ผู้ใช้กรอกตามที่สรรพากรแจ้ง
  const criminalFineApplies = isAssessed || monthsLate > 0;
  const criminalFine = resolveCriminalFine(criminalFineApplies, criminalFineEntered, null);

  // 2. เงินเพิ่ม (Surcharge) - 1.5% ต่อเดือน (เศษของเดือนปัดเป็น 1 เดือน) และสูงสุดไม่เกินยอดภาษี
  let surcharge = 0;
  if (taxOwed > 0 && monthsLate > 0) {
    const calculatedSurcharge = taxOwed * 0.015 * monthsLate;
    surcharge = round2(Math.min(calculatedSurcharge, taxOwed));
  }

  // 3. เบี้ยปรับ (Penalty)
  // เบี้ยปรับตามกฎหมาย: ยื่นไม่ครบ (ม.89(4)) 1 เท่า / ไม่ยื่นแบบ (ม.89(3)) 2 เท่า ของภาษี
  const penaltyMultiplier =
    scenario === 'voluntary_additional' || scenario === 'assessed_incorrect' ? 1.0 : 2.0;
  const penaltyOriginal = round2(taxOwed * penaltyMultiplier);

  // % ของเบี้ยปรับตามกฎหมายที่ต้องเสีย
  const penaltyDiscountPercent = isAssessed
    ? VAT_ASSESSED_PERCENT[assessedReduction]
    : vatVoluntaryPenaltyPercent(diffDays);
  const penaltyReduced = round2((penaltyOriginal * penaltyDiscountPercent) / 100);

  const totalPenaltiesAndSurcharges = round2(criminalFine + surcharge + penaltyReduced);
  const totalToPay = round2(taxOwed + totalPenaltiesAndSurcharges);

  return {
    taxOwed,
    monthsLate,
    deadlineDate,
    criminalFine,
    criminalFineApplies,
    criminalFineMax: null,
    surcharge,
    penaltyOriginal,
    penaltyReduced,
    penaltyMultiplier,
    penaltyDiscountPercent,
    penaltyPercentApplied: penaltyDiscountPercent,
    totalToPay,
    totalPenaltiesAndSurcharges,
  };
}
