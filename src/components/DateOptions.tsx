import React from 'react';
import { thaiDate } from '../utils/history';
import DateField from './DateField';

interface Props {
  idPrefix: string;
  filingSame: boolean;
  onFilingSame: (v: boolean) => void;
  filingDate: string;
  onFilingDate: (v: string) => void;
  customOn: boolean;
  onCustomOn: (v: boolean) => void;
  customDeadline: string;
  onCustomDeadline: (v: string) => void;
  standardDeadline: string; // วันครบกำหนดมาตรฐานของระบบ (ISO)
}


// ตัวเลือกวันที่เพิ่มเติม: แยกวันที่ยื่นแบบจากวันที่ชำระ และกำหนดวันครบกำหนดเอง
export default function DateOptions(p: Props) {
  return (
    <div className="space-y-3 p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700" htmlFor={`${p.idPrefix}-same`}>
          <input
            id={`${p.idPrefix}-same`}
            type="checkbox"
            checked={p.filingSame}
            onChange={(e) => p.onFilingSame(e.target.checked)}
          />
          ยื่นแบบและชำระภาษีวันเดียวกัน
        </label>
        {!p.filingSame && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block" htmlFor={`${p.idPrefix}-filing`}>
              วันที่ยื่นแบบ
            </label>
            <DateField id={`${p.idPrefix}-filing`} value={p.filingDate} onChange={p.onFilingDate} />
          </div>
        )}
        <p className="text-[10px] text-slate-400 font-light leading-snug">
          วันที่ยื่นแบบใช้ตัดสินว่าต้องเสียค่าปรับอาญาหรือไม่ ส่วนวันที่ชำระใช้นับเงินเพิ่ม ถ้าไม่มีภาษีต้องชำระ (เช่น ยื่นขอคืนภาษี)
          ให้ติ๊กออกแล้วระบุวันที่ยื่นแบบ
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700" htmlFor={`${p.idPrefix}-custom`}>
          <input
            id={`${p.idPrefix}-custom`}
            type="checkbox"
            checked={p.customOn}
            onChange={(e) => p.onCustomOn(e.target.checked)}
          />
          กำหนดวันครบกำหนดเอง (เช่น มีประกาศขยายเวลา หรือปีที่ไม่มีในรายการ)
        </label>
        {p.customOn ? (
          <DateField value={p.customDeadline} onChange={p.onCustomDeadline} ariaLabel="วันครบกำหนด" />
        ) : (
          <p className="text-[10px] text-slate-400 font-light">ใช้วันครบกำหนดมาตรฐาน: {thaiDate(p.standardDeadline)}</p>
        )}
      </div>
    </div>
  );
}
