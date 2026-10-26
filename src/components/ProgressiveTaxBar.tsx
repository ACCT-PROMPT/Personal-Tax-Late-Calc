import React from 'react';
import { formatBaht } from '../utils/format';
import { motion } from 'motion/react';

interface BracketBreakdownItem {
  bracketName: string;
  incomeInBracket: number;
  rate: number;
  tax: number;
}

interface ProgressiveTaxBarProps {
  netIncome: number;
  bracketBreakdown: BracketBreakdownItem[];
  totalTax: number;
}

export default function ProgressiveTaxBar({ netIncome, bracketBreakdown, totalTax }: ProgressiveTaxBarProps) {
  if (netIncome === 0) return null;

  return (
    <div className="p-4 bg-white/60 backdrop-blur-sm border border-slate-100 rounded-2xl space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-700">ฐานภาษีและอัตราภาษีที่เสียจริง</span>
        <span className="text-xs text-slate-500 font-mono">เงินได้สุทธิ: ฿{formatBaht(netIncome)}</span>
      </div>

      {/* แถบสีจำลองอัตราภาษีสะสม */}
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
        {bracketBreakdown.map((item, idx) => {
          if (item.incomeInBracket === 0) return null;
          
          // คำนวณความกว้างตามสัดส่วนเงินได้ที่ตกอยู่ในขั้นนี้
          const widthPercent = (item.incomeInBracket / netIncome) * 100;
          
          // สีที่ไล่ตามอัตราภาษี
          let bgClass = 'bg-slate-300';
          if (item.rate === 0) bgClass = 'bg-emerald-400';
          else if (item.rate === 0.05) bgClass = 'bg-teal-400';
          else if (item.rate === 0.10) bgClass = 'bg-cyan-400';
          else if (item.rate === 0.15) bgClass = 'bg-sky-400';
          else if (item.rate === 0.20) bgClass = 'bg-blue-400';
          else if (item.rate === 0.25) bgClass = 'bg-indigo-400';
          else if (item.rate === 0.30) bgClass = 'bg-violet-400';
          else bgClass = 'bg-purple-400';

          return (
            <motion.div
              key={idx}
              className={`${bgClass} h-full border-r border-white last:border-0`}
              initial={{ width: 0 }}
              animate={{ width: `${widthPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
              title={`${item.bracketName} (${item.rate * 100}%): ฿${formatBaht(item.incomeInBracket)}`}
            />
          );
        })}
      </div>

      {/* แสดงรายละเอียดแยกรายแบร็กเก็ต */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        {bracketBreakdown.map((item, idx) => {
          if (item.incomeInBracket === 0) return null;
          
          let dotColor = 'bg-slate-300';
          if (item.rate === 0) dotColor = 'bg-emerald-400';
          else if (item.rate === 0.05) dotColor = 'bg-teal-400';
          else if (item.rate === 0.10) dotColor = 'bg-cyan-400';
          else if (item.rate === 0.15) dotColor = 'bg-sky-400';
          else if (item.rate === 0.20) dotColor = 'bg-blue-400';
          else if (item.rate === 0.25) dotColor = 'bg-indigo-400';
          else if (item.rate === 0.30) dotColor = 'bg-violet-400';
          else dotColor = 'bg-purple-400';

          return (
            <div key={idx} className="flex justify-between items-center p-1.5 bg-slate-50/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span className="text-slate-600 font-medium">
                  {item.bracketName} ({item.rate * 100}%)
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-slate-500 mr-2">฿{formatBaht(item.incomeInBracket)}</span>
                <span className="font-semibold text-slate-800">฿{formatBaht(item.tax)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-medium text-slate-700">
        <span>ภาษีรวมตามอัตราก้าวหน้า:</span>
        <span className="text-sm font-bold text-slate-800">฿{formatBaht(totalTax)}</span>
      </div>
    </div>
  );
}
