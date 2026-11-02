import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { displayToIso, isoToDisplay, maskDateInput } from '../utils/dateFormat';

interface DateFieldProps {
  id?: string;
  value: string; // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  min?: string; // ISO ใช้กับปฏิทินที่เปิดจากปุ่มเท่านั้น
  max?: string;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_CLS =
  'w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors';

// ช่องกรอกวันที่แบบ วัน/เดือน/ปี (พ.ศ.) พิมพ์ได้ หรือกดไอคอนเลือกจากปฏิทิน
export default function DateField({ id, value, onChange, min, max, className, ariaLabel }: DateFieldProps) {
  const [text, setText] = useState<string>(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // ค่าจากภายนอกเปลี่ยน (เช่น เปิดรายการจากประวัติ) ให้แสดงตาม
  useEffect(() => {
    if (displayToIso(text) !== value) {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleType = (raw: string) => {
    const masked = maskDateInput(raw);
    setText(masked);
    const iso = displayToIso(masked);
    if (iso) {
      setInvalid(false);
      if (iso !== value) onChange(iso);
    } else {
      // ยังพิมพ์ไม่ครบ ไม่ถือว่าผิด จนกว่าจะครบ 10 ตัวอักษร
      setInvalid(masked.length === 10);
    }
  };

  const handleBlur = () => {
    // พิมพ์ไม่ครบหรือไม่ถูกต้อง ให้กลับไปใช้ค่าล่าสุดที่ถูกต้อง
    if (!displayToIso(text)) {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof (el as any).showPicker === 'function') (el as any).showPicker();
      else el.click();
    } catch {
      el.focus();
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="วว/ดด/ปปปป (พ.ศ.)"
          value={text}
          maxLength={10}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          onChange={(e) => handleType(e.target.value)}
          onBlur={handleBlur}
          className={`${className || DEFAULT_CLS} ${invalid ? '!border-rose-400 !ring-2 !ring-rose-200' : ''}`}
        />
        <button
          type="button"
          onClick={openPicker}
          title="เลือกจากปฏิทิน"
          aria-label="เลือกวันที่จากปฏิทิน"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
        >
          <Calendar className="w-4 h-4" />
        </button>
        {/* ปฏิทินของเบราว์เซอร์ ซ่อนไว้ใช้เฉพาะตอนเลือกวันที่ ไม่แสดงรูปแบบวันที่ของเครื่อง */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="absolute right-2 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
        />
      </div>
      {invalid && <p className="mt-1 text-[11px] text-rose-600">วันที่ไม่ถูกต้อง กรุณากรอกแบบ วัน/เดือน/ปี เช่น 29/06/2569</p>}
    </div>
  );
}
