export enum FilingMethod {
  PAPER = 'PAPER',
  ONLINE = 'ONLINE',
}

export enum FilingScenario {
  VOLUNTARY = 'VOLUNTARY', // ยื่นด้วยตนเอง
  ASSESSED_INCORRECT = 'ASSESSED_INCORRECT', // โดนประเมิน (ยื่นไว้ไม่ครบ/ผิด)
  ASSESSED_NOT_FILED = 'ASSESSED_NOT_FILED', // โดนประเมิน (ไม่ได้ยื่นแบบเลย)
}

export enum PenaltyReduction {
  WITHIN_30_DAYS = 'WITHIN_30_DAYS', // ภายใน 30 วัน (ลดเบี้ยปรับเหลือ 20%)
  WITHIN_60_DAYS = 'WITHIN_60_DAYS', // 31-60 วัน (ลดเบี้ยปรับเหลือ 25%)
  WITHIN_90_DAYS = 'WITHIN_90_DAYS', // 61-90 วัน (ลดเบี้ยปรับเหลือ 30%)
  OVER_90_DAYS = 'OVER_90_DAYS', // เกิน 90 วัน (ลดเบี้ยปรับเหลือ 50%)
  NO_REDUCTION = 'NO_REDUCTION', // ไม่ขอรับส่วนลด (จ่ายเต็ม 100%)
}

export interface TaxYearConfig {
  yearTh: number; // พ.ศ. (e.g., 2568)
  yearEn: number; // A.D. (e.g., 2025)
  paperDeadline: string; // ISO Date YYYY-MM-DD
  onlineDeadline: string; // ISO Date YYYY-MM-DD
}

export interface CalculationResult {
  taxOwed: number; // ภาษีที่ต้องจ่ายเพิ่ม
  monthsLate: number; // จำนวนเดือนที่ยื่นล่าช้า
  criminalFine: number; // ค่าปรับอาญา
  surcharge: number; // เงินเพิ่ม (1.5% ต่อเดือน)
  penaltyOriginal: number; // เบี้ยปรับเต็มจำนวน
  penaltyReduced: number; // เบี้ยปรับหลังหักส่วนลด
  penaltyDiscountPercent: number; // เปอร์เซ็นต์เบี้ยปรับที่ต้องจ่ายหลังหักส่วนลด
  totalToPay: number; // ยอดที่ต้องชำระรวมทั้งหมด
  totalPenaltiesAndSurcharges: number; // รวมค่าปรับและเงินเพิ่ม (ไม่รวมภาษีต้น)
}

export interface IncomeEstimation {
  income40_1: number; // เงินเดือน (40(1)) ทั้งปี
  incomeOther: number; // รายได้อื่นๆ ทั้งปี
  expenseMethod: 'standard' | 'actual'; // หักค่าใช้จ่ายแบบเหมาหรือตามจริง
  expenses: number; // ค่าใช้จ่ายหักออก
  personalAllowance: number; // ลดหย่อนส่วนตัว (ปกติ 60,000)
  otherAllowances: number; // ลดหย่อนอื่นๆ (เช่น ประกัน, กองทุน, ดอกเบี้ยบ้าน)
  taxAlreadyPaid: number; // ภาษีที่จ่ายไปแล้ว (เช่น ถูกหัก ณ ที่จ่าย หรือยื่นไปแล้วบางส่วน)
}
