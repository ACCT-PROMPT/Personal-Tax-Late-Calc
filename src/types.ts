export enum FilingMethod {
  PAPER = 'PAPER',
  ONLINE = 'ONLINE',
}

export enum FilingScenario {
  VOLUNTARY = 'VOLUNTARY', // ยื่นด้วยตนเอง
  ASSESSED_INCORRECT = 'ASSESSED_INCORRECT', // โดนประเมิน (ยื่นไว้ไม่ครบ/ผิด)
  ASSESSED_NOT_FILED = 'ASSESSED_NOT_FILED', // โดนประเมิน (ไม่ได้ยื่นแบบเลย)
}

// ท.ป. 81/2542 ข้อ 4: เจ้าพนักงานประเมินมีอำนาจลดเบี้ยปรับภาษีเงินได้ได้ตามดุลพินิจ
// แต่ต้องให้เสียไม่น้อยกว่าร้อยละ 50 ของเบี้ยปรับ (ไม่มีตารางตามช่วงวัน)
export enum PenaltyReduction {
  REDUCED_50 = 'REDUCED_50', // ได้รับอนุมัติลดเบี้ยปรับ เหลือ 50% (ลดได้มากสุด)
  NO_REDUCTION = 'NO_REDUCTION', // ไม่ได้รับการลด (จ่ายเต็ม 100%)
}

// ภ.พ.30 กรณีถูกประเมิน: ท.ป. 81/2542 ข้อ 5(2)-(3) ลดเหลือ 40% หรือ 50% ของเบี้ยปรับ
export type VatAssessedReduction = 'NONE' | 'PCT_40' | 'PCT_50';

export interface TaxYearConfig {
  yearTh: number; // พ.ศ. (e.g., 2568)
  yearEn: number; // A.D. (e.g., 2025)
  paperDeadline: string; // ISO Date YYYY-MM-DD
  onlineDeadline: string; // ISO Date YYYY-MM-DD
}

export interface CalculationResult {
  taxOwed: number; // ภาษีที่ต้องจ่ายเพิ่ม
  monthsLate: number; // จำนวนเดือนที่ยื่นล่าช้า
  criminalFine: number; // ค่าปรับอาญา (ตามจำนวนที่ผู้ใช้กรอกจากที่สรรพากรแจ้ง; ไม่กรอก = 0)
  criminalFineApplies: boolean; // เข้าเงื่อนไขต้องเสียค่าปรับอาญาหรือไม่ (ล่าช้า/ถูกประเมิน)
  criminalFineMax: number | null; // เพดานตามกฎหมาย (ภ.ง.ด. ม.35 = 2,000 บาท) ภ.พ.30 ไม่มีค่าอ้างอิง
  surcharge: number; // เงินเพิ่ม (1.5% ต่อเดือน)
  penaltyOriginal: number; // เบี้ยปรับเต็มจำนวน
  penaltyReduced: number; // เบี้ยปรับหลังหักส่วนลด
  penaltyMultiplier: number; // เบี้ยปรับตามกฎหมาย กี่เท่าของภาษี (0, 1 หรือ 2)
  penaltyDiscountPercent: number; // เปอร์เซ็นต์ของเบี้ยปรับตามกฎหมายที่ต้องจ่ายหลังหักส่วนลด
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
