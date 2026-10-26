import {
  FilingMethod,
  FilingScenario,
  PenaltyReduction,
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
    paperDeadline: '2024-03-31',
    onlineDeadline: '2024-04-09', // วันที่ 8 เป็นวันหยุดชดเชยจักรี เลื่อนเป็นวันที่ 9
  },
  {
    yearTh: 2565,
    yearEn: 2022,
    paperDeadline: '2023-03-31',
    onlineDeadline: '2023-04-10', // วันที่ 8-9 เป็นวันเสาร์อาทิตย์ เลื่อนเป็นวันที่ 10
  }
];

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
  paymentDateStr: string
): CalculationResult {
  const yearConfig = TAX_YEARS.find(y => y.yearTh === taxYearTh) || TAX_YEARS[0];
  const deadlineStr = method === FilingMethod.ONLINE ? yearConfig.onlineDeadline : yearConfig.paperDeadline;
  
  // 1. คำนวณเดือนล่าช้า
  const monthsLate = calculateMonthsLate(deadlineStr, paymentDateStr);

  // 2. คำนวณค่าปรับอาญา (Criminal Fine)
  let criminalFine = 0;
  if (scenario === FilingScenario.VOLUNTARY) {
    if (monthsLate === 0) {
      criminalFine = 0;
    } else {
      // ตรวจสอบว่าล่าช้าไม่เกิน 7 วันหรือไม่
      const deadline = new Date(deadlineStr);
      deadline.setHours(0, 0, 0, 0);
      const paymentDate = new Date(paymentDateStr);
      paymentDate.setHours(0, 0, 0, 0);
      
      const diffTime = paymentDate.getTime() - deadline.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        criminalFine = 100; // ไม่เกิน 7 วัน ปรับ 100 บาท
      } else {
        criminalFine = 200; // เกิน 7 วัน ปรับ 200 บาท
      }
    }
  } else {
    // กรณีเจ้าหน้าที่ประเมิน มักโดนปรับอัตราเต็มสำหรับค่าปรับอาญาล่าช้า (สูงสุด 2,000 บาท)
    criminalFine = taxOwed > 0 ? 2000 : 200;
  }

  // 3. คำนวณเงินเพิ่ม (Surcharge) - 1.5% ต่อเดือนของภาษีที่ต้องชำระ (เศษของเดือนปัดเป็น 1 เดือน)
  // และไม่เกินตัวเงินภาษีที่ค้างชำระ
  let surcharge = 0;
  if (taxOwed > 0 && monthsLate > 0) {
    const calculatedSurcharge = taxOwed * 0.015 * monthsLate;
    surcharge = Math.min(calculatedSurcharge, taxOwed); // ห้ามเกินจำนวนเงินภาษีที่ค้างชำระ
  }

  // 4. คำนวณเบี้ยปรับ (Penalty)
  let penaltyMultiplier = 0;
  if (scenario === FilingScenario.ASSESSED_INCORRECT) {
    penaltyMultiplier = 1.0; // ยื่นไว้ไม่ครบ โดน 1 เท่า
  } else if (scenario === FilingScenario.ASSESSED_NOT_FILED) {
    penaltyMultiplier = 2.0; // ไม่ได้ยื่นแบบเลย โดน 2 เท่า
  }

  const penaltyOriginal = taxOwed * penaltyMultiplier;

  // เปอร์เซ็นต์เบี้ยปรับที่ต้องจ่ายจริงหลังได้รับการลดหย่อน
  let penaltyDiscountPercent = 100;
  if (scenario !== FilingScenario.VOLUNTARY) {
    switch (reduction) {
      case PenaltyReduction.WITHIN_30_DAYS:
        penaltyDiscountPercent = 20; // ลดเหลือ 20%
        break;
      case PenaltyReduction.WITHIN_60_DAYS:
        penaltyDiscountPercent = 25; // ลดเหลือ 25%
        break;
      case PenaltyReduction.WITHIN_90_DAYS:
        penaltyDiscountPercent = 30; // ลดเหลือ 30%
        break;
      case PenaltyReduction.OVER_90_DAYS:
        penaltyDiscountPercent = 50; // ลดเหลือ 50%
        break;
      case PenaltyReduction.NO_REDUCTION:
      default:
        penaltyDiscountPercent = 100; // จ่ายเต็ม 100%
        break;
    }
  } else {
    penaltyDiscountPercent = 0; // ยื่นเองไม่มีเบี้ยปรับ
  }

  const penaltyReduced = (penaltyOriginal * penaltyDiscountPercent) / 100;

  // 5. สรุปยอดรวม
  const totalPenaltiesAndSurcharges = criminalFine + surcharge + penaltyReduced;
  const totalToPay = taxOwed + totalPenaltiesAndSurcharges;

  return {
    taxOwed,
    monthsLate,
    criminalFine,
    surcharge,
    penaltyOriginal,
    penaltyReduced,
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
    const rangeSize = bracket.max - bracket.min + 1;
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
  const personalAllowance = 60000; // ค่าลดหย่อนส่วนตัวปกติ 60,000 บาท
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
  criminalFine: number;
  surcharge: number;
  penaltyOriginal: number;
  penaltyReduced: number;
  penaltyPercentApplied: number;
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

// คำนวณเบี้ยปรับ เงินเพิ่ม และค่าปรับอาญาของ VAT (ภ.พ.30)
export function calculateVatPenalties(
  taxOwed: number,
  month: number,
  yearTh: number,
  method: FilingMethod,
  scenario: 'voluntary_additional' | 'voluntary_late' | 'assessed_incorrect' | 'assessed_not_filed',
  paymentDateStr: string
): VatCalculationResult {
  const deadlineDate = getVatDeadline(month, yearTh, method);
  const monthsLate = calculateMonthsLate(deadlineDate, paymentDateStr);

  // 1. ค่าปรับทางอาญา (Criminal Fine) สำหรับ ภ.พ.30 ล่าช้า
  let criminalFine = 0;
  if (monthsLate > 0) {
    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);
    const paymentDate = new Date(paymentDateStr);
    paymentDate.setHours(0, 0, 0, 0);

    const diffTime = paymentDate.getTime() - deadline.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      criminalFine = 300; // ไม่เกิน 7 วัน ปรับ 300 บาท
    } else {
      criminalFine = 500; // เกิน 7 วัน ปรับ 500 บาท
    }
  }

  // 2. เงินเพิ่ม (Surcharge) - 1.5% ต่อเดือน (เศษของเดือนปัดเป็น 1 เดือน) และสูงสุดไม่เกินยอดภาษี
  let surcharge = 0;
  if (taxOwed > 0 && monthsLate > 0) {
    const calculatedSurcharge = taxOwed * 0.015 * monthsLate;
    surcharge = Math.min(calculatedSurcharge, taxOwed);
  }

  // 3. เบี้ยปรับ (Penalty)
  let penaltyOriginalMultiplier = 0;
  let penaltyPercentApplied = 0;

  if (scenario === 'voluntary_additional') {
    // สมัครใจยื่นเพิ่มเติม (เคยยื่นไว้แล้วแต่ไม่ครบ) - เบี้ยปรับเต็ม 1 เท่า (100%)
    penaltyOriginalMultiplier = 1.0;

    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);
    const paymentDate = new Date(paymentDateStr);
    paymentDate.setHours(0, 0, 0, 0);
    const diffTime = paymentDate.getTime() - deadline.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      penaltyPercentApplied = 0;
    } else if (diffDays <= 15) {
      penaltyPercentApplied = 2; // เหลือ 2% ของยอดภาษีที่ขาด
    } else if (diffDays <= 30) {
      penaltyPercentApplied = 5; // เหลือ 5%
    } else if (diffDays <= 60) {
      penaltyPercentApplied = 10; // เหลือ 10%
    } else {
      penaltyPercentApplied = 20; // เหลือ 20%
    }
  } else if (scenario === 'voluntary_late') {
    // สมัครใจยื่นล่าช้า (ไม่เคยยื่นเลยแล้วมายื่นล่าช้า) - เบี้ยปรับเต็ม 2 เท่า (200%)
    penaltyOriginalMultiplier = 2.0;

    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);
    const paymentDate = new Date(paymentDateStr);
    paymentDate.setHours(0, 0, 0, 0);
    const diffTime = paymentDate.getTime() - deadline.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      penaltyPercentApplied = 0;
    } else if (diffDays <= 15) {
      penaltyPercentApplied = 10; // เหลือ 10% ของยอดภาษี
    } else if (diffDays <= 30) {
      penaltyPercentApplied = 20; // เหลือ 20%
    } else if (diffDays <= 60) {
      penaltyPercentApplied = 30; // เหลือ 30%
    } else {
      penaltyPercentApplied = 40; // เหลือ 40%
    }
  } else if (scenario === 'assessed_incorrect') {
    // เจ้าหน้าที่ประเมิน (เคยยื่นไม่ครบ) - เบี้ยปรับเต็ม 1 เท่า (100%)
    penaltyOriginalMultiplier = 1.0;
    penaltyPercentApplied = 100;
  } else if (scenario === 'assessed_not_filed') {
    // เจ้าหน้าที่ประเมิน (ไม่เคยยื่นแบบ) - เบี้ยปรับเต็ม 2 เท่า (200%)
    penaltyOriginalMultiplier = 2.0;
    penaltyPercentApplied = 200;
  }

  const penaltyOriginal = taxOwed * penaltyOriginalMultiplier;
  const penaltyReduced = (taxOwed * penaltyPercentApplied) / 100;

  const totalPenaltiesAndSurcharges = criminalFine + surcharge + penaltyReduced;
  const totalToPay = taxOwed + totalPenaltiesAndSurcharges;

  return {
    taxOwed,
    monthsLate,
    deadlineDate,
    criminalFine,
    surcharge,
    penaltyOriginal,
    penaltyReduced,
    penaltyPercentApplied,
    totalToPay,
    totalPenaltiesAndSurcharges,
  };
}
