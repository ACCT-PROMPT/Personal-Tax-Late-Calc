// จัดรูปแบบตัวเลขให้เหมือนกันทุกเครื่อง (ไม่ขึ้นกับภาษาของเบราว์เซอร์) มีคอมม่าคั่นหลักพันเสมอ
const LOCALE = 'en-US';

// จำนวนเงินบาท: มีคอมม่า และทศนิยม 2 ตำแหน่งเป็นค่าเริ่มต้น เช่น 1234.5 -> 1,234.50
export function formatBaht(value: number, decimals: number = 2): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ตัวเลขทั่วไป (ไม่ใช่จำนวนเงิน) เช่น เปอร์เซ็นต์ จำนวนเดือน
export function formatNumber(value: number, maxDecimals: number = 2): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxDecimals });
}

// ใช้กับช่องกรอก: ใส่คอมม่าให้ขณะพิมพ์ โดยคงทศนิยมที่พิมพ์ไว้
export function formatInputNumber(value: number | string): string {
  if (value === undefined || value === null) return '';
  const clean = value.toString().replace(/,/g, '');
  if (clean === '') return '';
  const parts = clean.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
