import React from 'react';
import { motion } from 'motion/react';

interface DonutChartProps {
  tax: number;
  surcharge: number;
  criminalFine: number;
  penalty: number;
}

export default function TaxDonutChart({ tax, surcharge, criminalFine, penalty }: DonutChartProps) {
  const total = tax + surcharge + criminalFine + penalty;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <span className="text-sm text-slate-400">กรอกข้อมูลเพื่อแสดงกราฟฟิกเปรียบเทียบ</span>
      </div>
    );
  }

  // คำนวณเปอร์เซ็นต์
  const pTax = (tax / total) * 100;
  const pSurcharge = (surcharge / total) * 100;
  const pCriminal = (criminalFine / total) * 100;
  const pPenalty = (penalty / total) * 100;

  // การตั้งค่าวงกลม SVG
  const radius = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;

  // คำนวณ stroke-dashoffset ของแต่ละชิ้น
  const offsetTax = circumference;
  const offsetSurcharge = circumference - (circumference * pTax) / 100;
  const offsetCriminal = offsetSurcharge - (circumference * pSurcharge) / 100;
  const offsetPenalty = offsetCriminal - (circumference * pCriminal) / 100;

  const data = [
    { label: 'ภาษีต้น', value: tax, percent: pTax, color: 'stroke-emerald-500', bg: 'bg-emerald-500' },
    { label: 'เงินเพิ่ม (1.5%/เดือน)', value: surcharge, percent: pSurcharge, color: 'stroke-amber-500', bg: 'bg-amber-500' },
    { label: 'เบี้ยปรับ', value: penalty, percent: pPenalty, color: 'stroke-rose-500', bg: 'bg-rose-500' },
    { label: 'ค่าปรับอาญา', value: criminalFine, percent: pCriminal, color: 'stroke-indigo-500', bg: 'bg-indigo-500' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-2xl">
      {/* SVG Donut */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          {/* พื้นหลังวงกลม */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="stroke-slate-100 fill-none"
            strokeWidth={strokeWidth}
          />
          
          {/* ชิ้นที่ 1: ภาษีต้น */}
          {tax > 0 && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              className={`${data[0].color} fill-none`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * pTax) / 100 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          )}

          {/* ชิ้นที่ 2: เงินเพิ่ม */}
          {surcharge > 0 && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              className={`${data[1].color} fill-none`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * (pTax + pSurcharge)) / 100 }}
              style={{ strokeDashoffset: offsetSurcharge }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              strokeLinecap="round"
            />
          )}

          {/* ชิ้นที่ 3: เบี้ยปรับ */}
          {penalty > 0 && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              className={`${data[2].color} fill-none`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * (pTax + pSurcharge + pPenalty)) / 100 }}
              style={{ strokeDashoffset: offsetCriminal }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              strokeLinecap="round"
            />
          )}

          {/* ชิ้นที่ 4: ค่าปรับอาญา */}
          {criminalFine > 0 && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              className={`${data[3].color} fill-none`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (circumference * (pTax + pSurcharge + pPenalty + pCriminal)) / 100 }}
              style={{ strokeDashoffset: offsetPenalty }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* ข้อความตรงกลาง */}
        <div className="absolute text-center">
          <span className="block text-xs font-medium text-slate-400">ค่าปรับ & เงินเพิ่ม</span>
          <span className="block text-sm font-semibold text-rose-600">
            {(( (surcharge + penalty + criminalFine) / total) * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* คำอธิบายสีกราฟ */}
      <div className="flex-1 flex flex-col gap-2 w-full min-w-0">
        {data.map((item, index) => {
          if (item.value === 0) return null;
          return (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 bg-slate-50/60 rounded-xl border border-slate-100/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <span className={`w-2.5 h-2.5 rounded-full ${item.bg} shrink-0`} />
                <span className="text-[11px] font-semibold text-slate-600 truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-right">
                <span className="text-xs font-bold text-slate-800">
                  ฿{item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({item.percent.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
