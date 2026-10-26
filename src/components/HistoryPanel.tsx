import React, { useState } from 'react';
import { History, FileSpreadsheet, Trash2, RotateCcw, Loader2, Download } from 'lucide-react';
import { HistoryRecord, thaiDateTime, thaiDate } from '../utils/history';
import { formatBaht } from '../utils/format';

interface HistoryPanelProps {
  records: HistoryRecord[];
  onLoad: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExportAll: () => Promise<void>;
  onExportOne: (record: HistoryRecord) => Promise<void>;
}

export default function HistoryPanel({ records, onLoad, onDelete, onClear, onExportAll, onExportOne }: HistoryPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setBusy(null);
    }
  };

  const sumTotal = records.reduce((s, r) => s + r.result.totalToPay, 0);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">ประวัติการคำนวณ</h2>
          <span className="px-1.5 py-0.5 text-[10px] bg-indigo-50 text-indigo-700 font-bold rounded">
            {records.length} รายการ
          </span>
        </div>
        {records.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => run('all', onExportAll)}
              disabled={busy !== null}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-semibold border bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 transition-all disabled:opacity-60"
            >
              {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              ดาวน์โหลด Excel ทั้งหมด
            </button>
            {confirmClear ? (
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="text-rose-600 font-semibold">ลบทั้งหมด?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setConfirmClear(false);
                  }}
                  className="py-1 px-2 rounded-lg bg-rose-600 text-white font-semibold"
                >
                  ยืนยัน
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="py-1 px-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  ยกเลิก
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-semibold border bg-white text-slate-500 border-slate-200 hover:text-rose-600 hover:border-rose-200 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ล้างประวัติ
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 font-light leading-relaxed">
        ประวัติถูกเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น ไม่ได้ส่งไปที่ใด หากล้างข้อมูลเบราว์เซอร์ เปลี่ยนเครื่อง หรือใช้โหมดส่วนตัว
        ประวัติจะหาย แนะนำให้ดาวน์โหลด Excel เก็บไว้เป็นระยะ (เก็บได้สูงสุด 200 รายการ)
      </p>

      {records.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 font-light">
          ยังไม่มีประวัติ กดปุ่ม "บันทึกลงประวัติ" ที่ผลการคำนวณเพื่อเก็บไว้ดูภายหลัง
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 border-b border-slate-100">
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
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60 align-top">
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
                  <td className="py-2 px-2 text-right whitespace-nowrap">
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
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs font-bold text-slate-900">
                <td colSpan={5} className="py-2 px-2 text-right">รวมทุกรายการ</td>
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
