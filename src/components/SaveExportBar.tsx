import React, { useState } from 'react';
import { Save, FileSpreadsheet, Check, Loader2 } from 'lucide-react';

interface SaveExportBarProps {
  onSave: (label: string) => boolean; // คืน true ถ้าบันทึกสำเร็จ
  onExport: (label: string) => Promise<void>;
}

// ช่องตั้งชื่ออ้างอิง + ปุ่ม "บันทึกลงประวัติ" และ "ดาวน์โหลด Excel (ผลนี้)"
export default function SaveExportBar({ onSave, onExport }: SaveExportBarProps) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const handleSave = () => {
    const ok = onSave(label.trim());
    setStatus(ok ? 'saved' : 'failed');
    setTimeout(() => setStatus('idle'), 2500);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await onExport(label.trim());
    } catch (err) {
      console.error('Export failed', err);
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2 pt-3 border-t border-slate-100/80 no-print">
      <label className="text-[11px] font-semibold text-slate-600 block" htmlFor="record-label">
        ชื่อลูกค้า / เลขอ้างอิง (ไม่บังคับ)
      </label>
      <input
        id="record-label"
        type="text"
        value={label}
        maxLength={80}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="เช่น คุณสมชาย / ภ.ง.ด.91 ปี 2568"
        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
            status === 'saved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : status === 'failed'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm'
          }`}
        >
          {status === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {status === 'saved' ? 'บันทึกแล้ว' : status === 'failed' ? 'บันทึกไม่ได้' : 'บันทึกลงประวัติ'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-semibold border bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-sm transition-all cursor-pointer disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
          {exporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel (ผลนี้)'}
        </button>
      </div>
      {status === 'failed' && (
        <p className="text-[10px] text-rose-600 font-light">
          เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล (อาจเปิดโหมดส่วนตัวอยู่) แนะนำให้ดาวน์โหลด Excel เก็บไว้แทน
        </p>
      )}
      {exportError && (
        <p className="text-[10px] text-rose-600 font-light">สร้างไฟล์ Excel ไม่สำเร็จ ลองใหม่อีกครั้ง</p>
      )}
    </div>
  );
}
