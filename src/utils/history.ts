import { FilingMethod, FilingScenario, PenaltyReduction, VatAssessedReduction } from '../types';

// ประวัติการคำนวณเก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งข้อมูลไปที่ใด
const STORAGE_KEY = 'taxLateCalc.history.v1';
export const MAX_HISTORY = 200;

export type HistoryKind = 'pit' | 'vat';
export type VatScenario = 'voluntary_additional' | 'voluntary_late' | 'assessed_incorrect' | 'assessed_not_filed';

export const PIT_SCENARIO_TEXT: Record<FilingScenario, string> = {
  [FilingScenario.VOLUNTARY]: 'ยื่นเพิ่มเติมด้วยตนเอง',
  [FilingScenario.ASSESSED_INCORRECT]: 'สรรพากรประเมิน (ยื่นไว้แต่ไม่ครบ)',
  [FilingScenario.ASSESSED_NOT_FILED]: 'สรรพากรประเมิน (ไม่ได้ยื่นแบบเลย)',
};

export const VAT_SCENARIO_TEXT: Record<VatScenario, string> = {
  voluntary_additional: 'สมัครใจยื่นเพิ่มเติม (เคยยื่นแต่ไม่ครบ)',
  voluntary_late: 'สมัครใจยื่นล่าช้า (ไม่เคยยื่น)',
  assessed_incorrect: 'สรรพากรประเมิน (ยื่นไว้แต่ไม่ครบ)',
  assessed_not_filed: 'สรรพากรประเมิน (ไม่ได้ยื่นแบบเลย)',
};

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// "2026-04-08" -> "8 เม.ย. 2569" (แยกค่าเองเพื่อไม่ให้เวลาท้องถิ่นทำให้วันคลาดเคลื่อน)
export function thaiDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  return `${parseInt(m[3], 10)} ${THAI_MONTHS_SHORT[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
}

// เวลาบันทึก แสดงเป็น "26 ต.ค. 2569 17:05"
export function thaiDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543} ${hh}:${mm}`;
}

export interface ResultSnapshot {
  taxOwed: number;
  monthsLate: number;
  criminalFine: number;
  criminalFineApplies: boolean;
  surcharge: number;
  penaltyOriginal: number;
  penaltyReduced: number;
  penaltyMultiplier: number;
  penaltyDiscountPercent: number;
  totalToPay: number;
}

// ค่าที่กรอก ใช้เปิดกลับมาคำนวณใหม่ได้
export interface HistoryInputs {
  filingMethod: FilingMethod;
  paymentDate: string;
  taxOwed: number;
  criminalFineEntered: number;
  filingDate?: string; // วันที่ยื่นแบบ (ไม่มี = ยื่นและชำระวันเดียวกัน)
  customDeadline?: string; // วันครบกำหนดที่กำหนดเอง
  // ภ.ง.ด.90/91
  taxYearTh?: number;
  scenario?: FilingScenario;
  reduction?: PenaltyReduction;
  // ภ.พ.30
  vatMonth?: number;
  vatYearTh?: number;
  vatScenario?: VatScenario;
  vatAssessedReduction?: VatAssessedReduction;
  vatMultiplier?: 'auto' | 1 | 2;
}

// สรุปที่มาของภาษี เมื่อใช้ตัวช่วยคำนวณรายได้ (ใช้สร้างแผ่น "ที่มาของภาษี" ใน Excel)
export interface EstimateSnapshot {
  lines: { title: string; section: string; amount: number; basis: string; expense: number; net: number }[];
  allowances: { label: string; claimed: number; allowed: number; capNote: string }[];
  assessableIncome: number;
  totalExpenses: number;
  totalAllowances: number;
  netIncome: number;
  progressiveTax: number;
  minTaxBase: number;
  minTax: number;
  minTaxApplies: boolean;
  taxTotal: number;
  credits: number;
  additionalTax: number;
  refund: number;
}

export interface HistoryRecord {
  id: string;
  savedAt: string; // ISO
  label: string; // ชื่อลูกค้า/เลขอ้างอิง ที่ผู้ใช้ตั้งเอง
  kind: HistoryKind;
  taxTypeText: string; // ชื่อภาษี
  periodText: string; // ปีภาษี หรือ เดือนภาษี
  methodText: string; // ช่องทางยื่น
  scenarioText: string;
  penaltyRuleText: string; // เงื่อนไขการลดเบี้ยปรับที่ใช้
  deadline: string; // ISO วันที่ครบกำหนด
  inputs: HistoryInputs;
  result: ResultSnapshot;
  estimate?: EstimateSnapshot; // มีเมื่อภาษีที่ค้างมาจากตัวช่วยคำนวณรายได้
}

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r.id === 'string' && typeof r.savedAt === 'string' && r.result && r.inputs
    ) as HistoryRecord[];
  } catch {
    return [];
  }
}

// คืน true ถ้าบันทึกสำเร็จ (localStorage อาจถูกปิด/เต็ม)
export function saveHistory(list: HistoryRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    return true;
  } catch {
    return false;
  }
}

export function newRecordId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
