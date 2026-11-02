// วันที่ในช่องกรอกแสดงเป็น วัน/เดือน/ปี (พ.ศ.) เช่น 29/06/2569 ไม่ขึ้นกับภาษาของเบราว์เซอร์
// (ช่อง <input type="date"> ของเบราว์เซอร์จะแสดง เดือน/วัน/ปี ตามภาษาเครื่อง จึงใช้ช่องข้อความแทน)
// ค่าภายในแอปยังเป็น ISO "YYYY-MM-DD" (ค.ศ.) เหมือนเดิม

export const BE_OFFSET = 543;

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// "2026-06-29" -> "29/06/2569"
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${m[3]}/${m[2]}/${parseInt(m[1], 10) + BE_OFFSET}`;
}

// "29/06/2569" (หรือ 29/06/2026) -> "2026-06-29"; ไม่ถูกต้องคืน null
// ปีตั้งแต่ 2400 ขึ้นไปถือเป็น พ.ศ. ปี 1900-2399 ถือเป็น ค.ศ.
export function displayToIso(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((text || '').trim());
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y >= 2400) y -= BE_OFFSET;
  else if (y < 1900) return null;
  if (!isRealDate(y, mo, d)) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ใส่เครื่องหมาย / ให้อัตโนมัติขณะพิมพ์: "29062569" -> "29/06/2569"
export function maskDateInput(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// วันที่ปัจจุบันตามปฏิทินของเครื่องผู้ใช้ เป็น ISO "YYYY-MM-DD" (ใช้เวลาท้องถิ่น ไม่ใช่ UTC)
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
