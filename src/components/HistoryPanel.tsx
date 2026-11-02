import React, { useEffect, useRef, useState } from 'react';
import { History, FileSpreadsheet, Trash2, RotateCcw, Loader2, Download, GitCompare, X } from 'lucide-react';
import { HistoryRecord, thaiDateTime, thaiDate } from '../utils/history';
import { formatBaht } from '../utils/format';

// จำนวนรายการที่เปรียบเทียบได้ในไฟล์เดียว (ตรงกับ MAX_COMPARE ใน excel.ts)
const COMPARE_MIN = 2;
const COMPARE_MAX = 10;

interface HistoryPanelProps {
  records: HistoryRecord[];
  onLoad: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExportMany: (records: HistoryRecord[], selected: boolean) => Promise<void>;
  onCompare: (records: HistoryRecord[]) => Promise<void>;
  onExportOne: (record: HistoryRecord) => Promise<void>;
}

export default function HistoryPanel({ records, onLoad, onDelete, onClear, onExportMany, onCompare, onExportOne }: HistoryPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  // ตัดรายการที่ถูกลบออกจากที่เลือกไว้
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(records.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [records]);

  const selectedRecords = records.filter((r) => selected.has(r.id));
  const allSelected = records.length > 0 && selected.size === records.length;
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(false);
    try {
      await fn();
    } catch (err) {
      console.error('Export failed', err);
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sumTotal = records.reduce((s, r) => s + r.result.totalToPay, 0);
  const canCompare = selected.size >= COMPARE_MIN && selected.size <= COMPARE_MAX;
  const btn =
    'flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 no-print">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">ประวัติการคำนวณ</h2>
          <span className="px-1.5 py-0.5 text-[10px] bg-indigo-50 text-indigo-700 font-bold rounded">{records.length} รายการ</span>
          {selected.size > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 font-bold rounded">เลือกแล้ว {selected.size}</span>
          )}
        </div>
        {records.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => run('all', () => onExportMany(records, false))}
              disabled={busy !== null}
              className={`${btn} bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50`}
            >
              {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              ดาวน์โหลดทั้งหมด ({records.length})
            </button>
            <button
              type="button"
              onClick={() => run('selected', () => onExportMany(selectedRecords, true))}
              disabled={busy !== null || selected.size === 0}
              className={`${btn} bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700`}
            >
              {busy === 'selected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              ดาวน์โหลดที่เลือก ({selected.size})
            </button>
            <button
              type="button"
              onClick={() => run('compare', () => onCompare(selectedRecords))}
              disabled={busy !== null || !canCompare}
              title={`เลือก ${COMPARE_MIN}-${COMPARE_MAX} รายการเพื่อดาวน์โหลดไฟล์เปรียบเทียบ`}
              className={`${btn} bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700`}
            >
              {busy === 'compare' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
              ดาวน์โหลดเปรียบเทียบ ({selected.size})
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className={`${btn} bg-white text-slate-500 border-slate-200 hover:text-slate-800`}>
                <X className="w-3.5 h-3.5" />
                ล้างที่เลือก
              </button>
            )}
            {confirmClear ? (
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="text-rose-600 font-semibold">ลบประวัติทั้งหมด?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setConfirmClear(false);
                    setSelected(new Set());
                  }}
                  className="py-1 px-2 rounded-lg bg-rose-600 text-white font-semibold"
                >
                  ยืนยัน
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="py-1 px-2 rounded-lg border border-slate-200 text-slate-600">
                  ยกเลิก
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className={`${btn} bg-white text-slate-500 border-slate-200 hover:text-rose-600 hover:border-rose-200`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                ล้างประวัติ
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1 text-[11px] text-slate-500 font-light leading-relaxed">
        <p>
          ติ๊กเลือกรายการที่ต้องการ แล้วกด <strong className="font-semibold text-slate-700">ดาวน์โหลดที่เลือก</strong> หรือเลือก {COMPARE_MIN}-{COMPARE_MAX} รายการแล้วกด{' '}
          <strong className="font-semibold text-slate-700">ดาวน์โหลดเปรียบเทียบ</strong> (ตารางเทียบทีละรายการ พร้อมส่วนต่างและอันดับยอดรวม โดยรายการเก่าสุดเป็นฐาน)
          ไฟล์ดาวน์โหลดแต่ละรายการแนบสูตรคำนวณให้ตรวจสอบได้ (ถ้าเกิน 20 รายการจะได้เฉพาะตารางรวม)
        </p>
        <p className="text-slate-400">
          ประวัติถูกเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น ไม่ได้ส่งไปที่ใด หากล้างข้อมูลเบราว์เซอร์ เปลี่ยนเครื่อง หรือใช้โหมดส่วนตัว ประวัติจะหาย
          แนะนำให้ดาวน์โหลด Excel เก็บไว้เป็นระยะ (เก็บได้สูงสุด 200 รายการ)
        </p>
        {selected.size > COMPARE_MAX && (
          <p className="text-amber-700">เปรียบเทียบได้สูงสุด {COMPARE_MAX} รายการ ลดจำนวนที่เลือกลงก่อน (ดาวน์โหลดที่เลือกยังใช้ได้ทุกจำนวน)</p>
        )}
        {error && <p className="text-rose-600">สร้างไฟล์ Excel ไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 font-light">
          ยังไม่มีประวัติ กดปุ่ม "บันทึกลงประวัติ" ที่ผลการคำนวณเพื่อเก็บไว้ดูหรือดาวน์โหลดภายหลัง
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[780px]">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 border-b border-slate-100">
                <th className="py-2 px-2 w-8">
                  <input
                    ref={allRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)))}
                    aria-label="เลือกทุกรายการ"
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-2 px-2 font-semibold">บันทึกเมื่อ</th>
                <th className="py-2 px-2 font-semibold">อ้างอิง</th>
                <th className="py-2 px-2 font-semibold">ภาษี / งวด</th>
                <th className="py-2 px-2 font-semibold">ลักษณะการยื่น</th>
                <th className="py-2 px-2 font-semibold">ชำระวันที่</th>
                <th className="py-2 px-2 font-semibold text-right">ยอดรวม (บาท)</th>
                <th className="py-2 px-2 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isSel = selected.has(r.id);
                return (
                  <tr
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`border-b border-slate-50 align-top cursor-pointer ${isSel ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}`}
                  >
                    <td className="py-2 px-2">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`เลือกรายการ ${r.label || r.periodText}`}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{thaiDateTime(r.savedAt)}</td>
                    <td className="py-2 px-2 text-slate-800 font-medium">{r.label || <span className="text-slate-300">-</span>}</td>
                    <td className="py-2 px-2 text-slate-600">
                      <span className="block font-medium text-slate-800">{r.kind === 'pit' ? 'ภ.ง.ด.90/91' : 'ภ.พ.30'}</span>
                      <span className="block text-[10px] text-slate-400">{r.periodText}</span>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{r.scenarioText}</td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{thaiDate(r.inputs.paymentDate)}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {formatBaht(r.result.totalToPay)}
                      {r.result.criminalFineApplies && r.result.criminalFine === 0 && (
                        <span className="block text-[9px] text-amber-600 font-sans font-normal">ยังไม่รวมค่าปรับอาญา</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="เปิดกลับมาคำนวณใหม่"
                        onClick={() => onLoad(r)}
                        className="inline-flex items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        เปิดดู
                      </button>
                      <button
                        type="button"
                        title="ดาวน์โหลด Excel รายการนี้"
                        onClick={() => run(r.id, () => onExportOne(r))}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Excel
                      </button>
                      <button
                        type="button"
                        title="ลบรายการนี้"
                        onClick={() => onDelete(r.id)}
                        className="inline-flex items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-xs font-bold text-slate-900">
                <td colSpan={6} className="py-2 px-2 text-right">
                  รวมทุกรายการ{selected.size > 0 && <span className="font-normal text-slate-500"> | ที่เลือก {formatBaht(selectedRecords.reduce((s, r) => s + r.result.totalToPay, 0))}</span>}
                </td>
                <td className="py-2 px-2 text-right font-mono">{formatBaht(sumTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
