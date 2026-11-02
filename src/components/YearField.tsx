import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const MIN_YEAR_TH = 2550;
export const MAX_YEAR_TH = 2650;

interface YearFieldProps {
  id?: string;
  value: number; // พ.ศ.
  onChange: (year: number) => void;
  options: number[]; // ปีที่มีในรายการ
  optionLabel: (year: number) => string;
  hint?: string; // ข้อความอธิบายเมื่อเลือกปีที่ไม่อยู่ในรายการ
}

const selectCls =
  'w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none transition-colors';

// เลือกปีจากรายการ หรือเลือก "ปีอื่น" แล้วพิมพ์ปี พ.ศ. เองได้
export default function YearField({ id, value, onChange, options, optionLabel, hint }: YearFieldProps) {
  const inList = options.includes(value);
  const [custom, setCustom] = useState<boolean>(!inList);
  const [text, setText] = useState<string>(String(value));

  // ค่าจากภายนอกเปลี่ยน (เช่น เปิดรายการจากประวัติ)
  useEffect(() => {
    if (String(value) !== text) setText(String(value));
    if (!options.includes(value)) setCustom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const four = /^\d{4}$/.test(text);
  const n = parseInt(text, 10);
  const outOfRange = four && (n < MIN_YEAR_TH || n > MAX_YEAR_TH);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <select
          id={id}
          value={custom ? 'custom' : String(value)}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setCustom(true);
              setText(String(value));
            } else {
              setCustom(false);
              onChange(parseInt(e.target.value, 10));
            }
          }}
          className={selectCls}
        >
          {options.map((y) => (
            <option key={y} value={y}>
              {optionLabel(y)}
            </option>
          ))}
          <option value="custom">ปีอื่น (ระบุปี พ.ศ. เอง)</option>
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {custom && (
        <div className="space-y-1">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={text}
            aria-label="ปีภาษี พ.ศ. 4 หลัก"
            placeholder="เช่น 2569"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setText(v);
              const num = parseInt(v, 10);
              if (/^\d{4}$/.test(v) && num >= MIN_YEAR_TH && num <= MAX_YEAR_TH) onChange(num);
            }}
            onBlur={() => {
              if (!/^\d{4}$/.test(text) || outOfRange) setText(String(value));
            }}
            className={`${selectCls} !appearance-auto ${outOfRange ? '!border-rose-400 !ring-2 !ring-rose-200' : ''}`}
          />
          {outOfRange || (text.length === 4 && n < MIN_YEAR_TH) ? (
            <p className="text-[11px] text-rose-600">กรอกปี พ.ศ. 4 หลัก ระหว่าง {MIN_YEAR_TH}-{MAX_YEAR_TH} (เช่น 2569 ไม่ใช่ ค.ศ.)</p>
          ) : (
            hint && !inList && <p className="text-[11px] text-amber-700 leading-snug">{hint}</p>
          )}
        </div>
      )}
    </div>
  );
}
