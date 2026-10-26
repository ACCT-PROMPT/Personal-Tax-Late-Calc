import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calculator,
  AlertTriangle,
  Calendar,
  HelpCircle,
  CheckCircle,
  Percent,
  ArrowRight,
  BookOpen,
  Clock,
  RotateCcw,
  Sparkles,
  Building,
  ChevronDown,
  Check,
  Info,
  ChevronRight,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Copy,
  Printer,
  X,
  FileText,
  Download
} from 'lucide-react';

import html2canvas from 'html2canvas';

import {
  FilingMethod,
  FilingScenario,
  PenaltyReduction,
  VatAssessedReduction,
} from './types';

import {
  TAX_YEARS,
  LEGAL_BASIS,
  PIT_CRIMINAL_FINE_MAX,
  calculateTaxPenalties,
  calculateVatPenalties,
  getVatDeadline
} from './utils/taxCalc';

// แปลงข้อความตัวเลขที่ผู้ใช้กรอก (มีคอมม่าได้) เป็นจำนวน ถ้าว่าง/ไม่ใช่ตัวเลข = 0
const parseMoney = (value: string): number => {
  const n = parseFloat(value.replace(/,/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
};

import { formatBaht, formatInputNumber } from './utils/format';
import {
  HistoryRecord,
  PIT_SCENARIO_TEXT,
  VAT_SCENARIO_TEXT,
  THAI_MONTHS_FULL,
  loadHistory,
  saveHistory,
  newRecordId,
  MAX_HISTORY,
} from './utils/history';
import { exportRecordToExcel, exportHistoryToExcel } from './utils/excel';
import SaveExportBar from './components/SaveExportBar';
import HistoryPanel from './components/HistoryPanel';
import TaxDonutChart from './components/TaxDonutChart';
import IncomeEstimator from './components/IncomeEstimator';
import DateOptions from './components/DateOptions';
import { IncomeEstimateInput, estimateIncomeTax, defaultEstimateInput } from './utils/incomeTax';
import { AnimatedNumber } from './components/AnimatedNumber';

// ช่องกรอกค่าปรับอาญา: กรมสรรพากรไม่ได้ประกาศตารางตายตัว ให้กรอกตามจำนวนที่สรรพากรแจ้งจริง
function CriminalFineField({
  value,
  onChange,
  applies,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  applies: boolean;
  max: number | null;
}) {
  if (!applies) return null;
  return (
    <div className="space-y-1.5 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
      <label className="text-xs font-semibold text-slate-700 block">
        ค่าปรับอาญา (ถ้ามีแจ้งจากสรรพากร) — บาท
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="เว้นว่าง = ยังไม่รวมในยอด"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        className="w-full bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
      />
      <p className="text-[10px] text-slate-500 font-light leading-relaxed">
        {max !== null
          ? `ตามมาตรา 35 ปรับไม่เกิน ${formatBaht(max, 0)} บาท และกรมสรรพากรไม่ได้ประกาศอัตราตายตัว จึงใช้จำนวนที่เจ้าหน้าที่แจ้งหรือเปรียบเทียบปรับจริง (ระบบจะไม่เกินเพดาน)`
          : 'กรมสรรพากรไม่ได้ประกาศอัตราตายตัวที่ยืนยันได้ จึงใช้จำนวนที่เจ้าหน้าที่แจ้งหรือเปรียบเทียบปรับจริง'}
      </p>
    </div>
  );
}

export default function App() {
  // แท็บที่เลือกใช้งาน: ภาษีเงินได้บุคคลธรรมดา (pit) หรือ ภาษีมูลค่าเพิ่ม (vat)
  const [activeTab, setActiveTab] = useState<'pit' | 'vat'>('pit');

  // === โหมดภาษีมูลค่าเพิ่ม (VAT) ===
  const [vatOwedInput, setVatOwedInput] = useState<string>('10,000');
  const [vatMonth, setVatMonth] = useState<number>(5); // เดือนพฤษภาคม
  const [vatYearTh, setVatYearTh] = useState<number>(2568);
  const [vatFilingMethod, setVatFilingMethod] = useState<FilingMethod>(FilingMethod.ONLINE);
  const [vatScenario, setVatScenario] = useState<'voluntary_additional' | 'voluntary_late' | 'assessed_incorrect' | 'assessed_not_filed'>('voluntary_additional');
  const [vatPaymentDate, setVatPaymentDate] = useState<string>('2026-06-29');

  // โหมดการกรอกยอดภาษีค้างชำระสำหรับ VAT
  const [vatOwedMode, setVatOwedMode] = useState<'simple' | 'estimate'>('simple');
  const [vatSalesInput, setVatSalesInput] = useState<string>('150000');
  const [vatPurchasesInput, setVatPurchasesInput] = useState<string>('50000');
  const [vatUseAuto, setVatUseAuto] = useState<boolean>(true); // คำนวณ 7% อัตโนมัติ หรือไม่
  const [vatOutputVatInput, setVatOutputVatInput] = useState<string>('10500'); // ยอดภาษีขายกำหนดเอง
  const [vatInputVatInput, setVatInputVatInput] = useState<string>('3500'); // ยอดภาษีซื้อกำหนดเอง

  // โหมดการกรอกยอดภาษีค้างชำระ
  const [taxOwedMode, setTaxOwedMode] = useState<'simple' | 'estimate'>('simple');

  // ข้อมูลตั้งค่าหลัก
  const [taxYearTh, setTaxYearTh] = useState<number>(2568);
  const [filingMethod, setFilingMethod] = useState<FilingMethod>(FilingMethod.ONLINE);
  const [scenario, setScenario] = useState<FilingScenario>(FilingScenario.VOLUNTARY);
  const [reduction, setReduction] = useState<PenaltyReduction>(PenaltyReduction.NO_REDUCTION);
  // ค่าปรับอาญาตามที่สรรพากรแจ้ง (ไม่มีตารางตายตัว จึงให้ผู้ใช้กรอกเอง; เว้นว่าง = ยังไม่รวมในยอด)
  const [pitCriminalFineInput, setPitCriminalFineInput] = useState<string>('');
  const [vatCriminalFineInput, setVatCriminalFineInput] = useState<string>('');
  const [vatAssessedReduction, setVatAssessedReduction] = useState<VatAssessedReduction>('NONE');
  // ประวัติการคำนวณ (เก็บใน localStorage ของเครื่องนี้)
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  // วันที่ยื่นแบบ (แยกจากวันที่ชำระ) และวันครบกำหนดที่กำหนดเอง
  const [pitFilingSame, setPitFilingSame] = useState<boolean>(true);
  const [pitFilingDate, setPitFilingDate] = useState<string>('2026-06-29');
  const [pitCustomOn, setPitCustomOn] = useState<boolean>(false);
  const [pitCustomDeadline, setPitCustomDeadline] = useState<string>('');
  const [vatFilingSame, setVatFilingSame] = useState<boolean>(true);
  const [vatFilingDate, setVatFilingDate] = useState<string>('2026-06-29');
  const [vatCustomOn, setVatCustomOn] = useState<boolean>(false);
  const [vatCustomDeadline, setVatCustomDeadline] = useState<string>('');
  // เบี้ยปรับ ภ.พ.30 กี่เท่าตามหนังสือประเมิน: 'auto' = ตามลักษณะที่เลือก
  const [vatMultiplier, setVatMultiplier] = useState<'auto' | 1 | 2>('auto');
  
  // วันที่คาดว่าจะยื่นชำระจริง (Default เป็นวันนี้ 2026-06-29 ตาม metadata)
  const [paymentDate, setPaymentDate] = useState<string>('2026-06-29');

  // ยอดภาษีขาดกรณีกรอกโดยตรง
  const [taxOwedInput, setTaxOwedInput] = useState<string>('5,000');

  // รายละเอียดสำหรับการประเมินรายได้เพื่อคำนวณภาษีขาด
  const [incomeEst, setIncomeEst] = useState<IncomeEstimateInput>(() => defaultEstimateInput());

  // ใช้สำหรับเปิด/ปิด สรุปขั้นตอนคำนวณอย่างย่อ
  const [showFormulaInfo, setShowFormulaInfo] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // ตัวจัดรูปแบบวันที่ให้อ่านง่ายเป็นภาษาไทย
  const formatThaiDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const thMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      return `${date.getDate()} ${thMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch {
      return dateStr;
    }
  };

  // ช่องกรอกตัวเลข: ใส่คอมม่าให้ขณะพิมพ์ (ใช้ตัวจัดรูปแบบกลาง)
  const formatNumberWithCommas = formatInputNumber;

  // ฟังก์ชันสำหรับคัดลอกรายงานสรุปผล
  const handleCopySummary = () => {
    let summaryText = '';
    if (activeTab === 'pit') {
      const scenarioText = scenario === FilingScenario.VOLUNTARY 
        ? 'ยื่นเพิ่มเติมด้วยตนเอง (Voluntary)' 
        : scenario === FilingScenario.ASSESSED_INCORRECT 
          ? 'สรรพากรตรวจสอบพบความผิดพลาด (ยื่นขาด)' 
          : 'สรรพากรตรวจสอบพบว่าไม่ได้ยื่นแบบ';
      
      summaryText = `📋 สรุปผลการประเมินเบี้ยปรับและเงินเพิ่มภาษีเงินได้บุคคลธรรมดา
-----------------------------------------
ปีภาษี: พ.ศ. ${taxYearTh} (รูปแบบการยื่น: ${filingMethod === FilingMethod.ONLINE ? 'ยื่นออนไลน์' : 'ยื่นกระดาษ'})
สถานการณ์การยื่น: ${scenarioText}
จำนวนเดือนที่ล่าช้า: ${calculationResult.monthsLate} เดือน (กำหนดชำระปกติ: ${formatThaiDate(currentDeadline)})
วันที่คาดว่าจะยื่นชำระจริง: ${formatThaiDate(paymentDate)}
-----------------------------------------
1. ยอดภาษีค้างชำระหลัก: ฿${formatBaht(calculationResult.taxOwed)}
2. ค่าปรับทางอาญา: ${calculationResult.criminalFineApplies && calculationResult.criminalFine === 0 ? 'ยังไม่รวมในยอด (ไม่เกิน 2,000 บาท ตาม ม.35 ตามที่สรรพากรแจ้ง)' : `฿${formatBaht(calculationResult.criminalFine)}`}
3. เงินเพิ่ม (ม. 27): ฿${formatBaht(calculationResult.surcharge)} (${calculationResult.monthsLate === 0 ? '0' : (1.5 * calculationResult.monthsLate).toFixed(1)}% ต่อเดือน)
4. ค่าเบี้ยปรับ (ม. 22): ฿${formatBaht(calculationResult.penaltyReduced)} (ลดจากยอดเต็ม ฿${formatBaht(calculationResult.penaltyOriginal)} คงเหลือ ${calculationResult.penaltyDiscountPercent}%)
-----------------------------------------
💰 ยอดรวมที่ต้องชำระทั้งหมด: ฿${formatBaht(calculationResult.totalToPay)}
ประหยัดเบี้ยปรับได้: ฿${formatBaht(calculationResult.penaltyOriginal - calculationResult.penaltyReduced)} บาท
-----------------------------------------
*คำนวณโดยระบบประเมินค่าปรับภาษีเงินได้บุคคลธรรมดาแบบ Real-time`;
    } else {
      const scenarioText = vatScenario === 'voluntary_additional'
        ? 'สมัครใจยื่นเพิ่มเติม (เคยยื่นแต่ไม่ครบ)'
        : vatScenario === 'voluntary_late'
          ? 'สมัครใจยื่นล่าช้าครั้งแรก (ไม่เคยยื่นเลย)'
          : vatScenario === 'assessed_incorrect'
            ? 'สรรพากรตรวจสอบพบ (ยื่นแบบไว้แต่ไม่ครบ)'
            : 'สรรพากรตรวจสอบพบ (ไม่เคยยื่นแบบเลย)';
            
      const monthNamesTh = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      
      summaryText = `📋 สรุปผลการประเมินเบี้ยปรับและเงินเพิ่มภาษีมูลค่าเพิ่ม (VAT ภ.พ.30)
-----------------------------------------
เดือนภาษี: ${monthNamesTh[vatMonth - 1]} พ.ศ. ${vatYearTh}
รูปแบบการยื่น: ${vatFilingMethod === FilingMethod.ONLINE ? 'ยื่นออนไลน์ (ภายในวันที่ 23)' : 'ยื่นกระดาษ (ภายในวันที่ 15)'}
สถานการณ์การยื่น: ${scenarioText}
จำนวนเดือนที่ล่าช้า: ${vatCalculationResult.monthsLate} เดือน (กำหนดชำระปกติ: ${formatThaiDate(vatDeadline)})
วันที่คาดว่าจะยื่นชำระจริง: ${formatThaiDate(vatPaymentDate)}
-----------------------------------------
1. ยอดภาษี VAT ค้างชำระหลัก: ฿${formatBaht(vatCalculationResult.taxOwed)}
2. ค่าปรับทางอาญา: ${vatCalculationResult.criminalFineApplies && vatCalculationResult.criminalFine === 0 ? 'ยังไม่รวมในยอด (ตามที่สรรพากรแจ้ง)' : `฿${formatBaht(vatCalculationResult.criminalFine)}`}
3. เงินเพิ่ม (1.5% ต่อเดือน): ฿${formatBaht(vatCalculationResult.surcharge)}
4. ค่าเบี้ยปรับ (ภ.พ.30): ฿${formatBaht(vatCalculationResult.penaltyReduced)} (เบี้ยปรับตามกฎหมาย ${vatCalculationResult.penaltyMultiplier} เท่า ฿${formatBaht(vatCalculationResult.penaltyOriginal)} เหลือเสียจริง ${vatCalculationResult.penaltyDiscountPercent}% ตาม ท.ป. 81/2542 ข้อ 5)
-----------------------------------------
💰 ยอดรวมที่ต้องชำระทั้งหมด: ฿${formatBaht(vatCalculationResult.totalToPay)}
ประหยัดเบี้ยปรับได้: ฿${formatBaht(vatCalculationResult.penaltyOriginal - vatCalculationResult.penaltyReduced)} บาท
-----------------------------------------
*คำนวณโดยระบบประเมินค่าปรับภาษีมูลค่าเพิ่ม (ภ.พ.30) แบบ Real-time`;
    }
    
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [exporting, setExporting] = useState<boolean>(false);

  const handleDownloadImage = async () => {
    const element = document.getElementById('printable-receipt');
    if (!element) return;
    try {
      setExporting(true);
      // Wait a microsecond for DOM to be stable
      await new Promise((resolve) => setTimeout(resolve, 50));
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Adjust styles on the cloned document for best image rendering if needed
          const clonedElement = clonedDoc.getElementById('printable-receipt');
          if (clonedElement) {
            clonedElement.style.padding = '24px';
            clonedElement.style.background = '#ffffff';
          }
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `tax-summary-year-${taxYearTh}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
    } finally {
      setExporting(false);
    }
  };

  // คำนวณตัวเลขทางภาษีขั้นต้น (กรณีเลือกโหมดประเมินรายได้)
  const estimationResult = useMemo(() => {
    return estimateIncomeTax(incomeEst);
  }, [incomeEst]);

  // ยอดภาษีค้างชำระที่จะนำไปคิดค่าปรับจริง
  const taxOwedToUse = useMemo(() => {
    if (taxOwedMode === 'simple') {
      const parsed = parseFloat(taxOwedInput.replace(/,/g, ''));
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    } else {
      return estimationResult.additionalTax;
    }
  }, [taxOwedMode, taxOwedInput, estimationResult]);

  const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const pitDeadlineOverride = pitCustomOn && isIso(pitCustomDeadline) ? pitCustomDeadline : undefined;
  const pitFilingArg = !pitFilingSame && isIso(pitFilingDate) ? pitFilingDate : undefined;
  const vatDeadlineOverride = vatCustomOn && isIso(vatCustomDeadline) ? vatCustomDeadline : undefined;
  const vatFilingArg = !vatFilingSame && isIso(vatFilingDate) ? vatFilingDate : undefined;

  // คำนวณเบี้ยปรับ เงินเพิ่ม และค่าปรับทั้งหมด
  const calculationResult = useMemo(() => {
    return calculateTaxPenalties(
      taxOwedToUse,
      taxYearTh,
      filingMethod,
      scenario,
      reduction,
      paymentDate,
      parseMoney(pitCriminalFineInput),
      pitFilingArg,
      pitDeadlineOverride
    );
  }, [taxOwedToUse, taxYearTh, filingMethod, scenario, reduction, paymentDate, pitCriminalFineInput, pitFilingArg, pitDeadlineOverride]);

  // === สำหรับหน้าภาษีมูลค่าเพิ่ม (VAT) ===
  const vatEstimationResult = useMemo(() => {
    const sales = parseFloat(vatSalesInput.replace(/,/g, '')) || 0;
    const purchases = parseFloat(vatPurchasesInput.replace(/,/g, '')) || 0;

    let outputVat = 0;
    if (vatUseAuto) {
      outputVat = Math.round(sales * 0.07 * 100) / 100;
    } else {
      outputVat = parseFloat(vatOutputVatInput.replace(/,/g, '')) || 0;
    }

    let inputVat = 0;
    if (vatUseAuto) {
      inputVat = Math.round(purchases * 0.07 * 100) / 100;
    } else {
      inputVat = parseFloat(vatInputVatInput.replace(/,/g, '')) || 0;
    }

    const netVatOwed = Math.max(0, outputVat - inputVat);

    return {
      sales,
      purchases,
      outputVat,
      inputVat,
      netVatOwed,
    };
  }, [vatSalesInput, vatPurchasesInput, vatUseAuto, vatOutputVatInput, vatInputVatInput]);

  const vatOwedToUse = useMemo(() => {
    if (vatOwedMode === 'simple') {
      const parsed = parseFloat(vatOwedInput.replace(/,/g, ''));
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    } else {
      return vatEstimationResult.netVatOwed;
    }
  }, [vatOwedMode, vatOwedInput, vatEstimationResult]);

  const vatCalculationResult = useMemo(() => {
    return calculateVatPenalties(
      vatOwedToUse,
      vatMonth,
      vatYearTh,
      vatFilingMethod,
      vatScenario,
      vatPaymentDate,
      parseMoney(vatCriminalFineInput),
      vatAssessedReduction,
      vatFilingArg,
      vatDeadlineOverride,
      vatMultiplier === 'auto' ? undefined : vatMultiplier
    );
  }, [vatOwedToUse, vatMonth, vatYearTh, vatFilingMethod, vatScenario, vatPaymentDate, vatCriminalFineInput, vatAssessedReduction, vatFilingArg, vatDeadlineOverride, vatMultiplier]);

  const vatStandardDeadline = useMemo(() => {
    return getVatDeadline(vatMonth, vatYearTh, vatFilingMethod);
  }, [vatMonth, vatYearTh, vatFilingMethod]);
  const vatDeadline = vatDeadlineOverride || vatStandardDeadline;

  // ข้อมูลปีภาษีปัจจุบันที่เลือก
  const currentYearConfig = useMemo(() => {
    return TAX_YEARS.find(y => y.yearTh === taxYearTh) || TAX_YEARS[0];
  }, [taxYearTh]);

  const pitStandardDeadline = useMemo(() => {
    return filingMethod === FilingMethod.ONLINE 
      ? currentYearConfig.onlineDeadline 
      : currentYearConfig.paperDeadline;
  }, [currentYearConfig, filingMethod]);
  const currentDeadline = pitDeadlineOverride || pitStandardDeadline;

  // รีเซ็ตข้อมูลในส่วนของความเสี่ยงรายได้กลับสู่ค่าเริ่มต้น
  const handleResetEstimation = () => {
    setIncomeEst(defaultEstimateInput());
  };

  // รีเซ็ตข้อมูลส่วนประมาณการภาษีมูลค่าเพิ่มกลับสู่ค่าเริ่มต้น
  const handleResetVatEstimation = () => {
    setVatSalesInput('150000');
    setVatPurchasesInput('50000');
    setVatUseAuto(true);
    setVatOutputVatInput('10500');
    setVatInputVatInput('3500');
  };

  // Dynamic resolution variables for sharing results/receipts between PIT and VAT
  const resultToUse = activeTab === 'pit' ? calculationResult : vatCalculationResult;
  const isVoluntaryResult = activeTab === 'pit' 
    ? (scenario === FilingScenario.VOLUNTARY) 
    : (vatScenario === 'voluntary_additional' || vatScenario === 'voluntary_late');
  const scenarioLabelResult = activeTab === 'pit'
    ? (scenario === FilingScenario.VOLUNTARY ? 'ยื่นเพิ่มเติมสมัครใจ' : 'เจ้าหน้าที่ตรวจประเมิน')
    : (vatScenario.startsWith('voluntary') ? 'ยื่นเพิ่มเติมสมัครใจ (ภ.พ.30)' : 'เจ้าหน้าที่ตรวจประเมิน (ภ.พ.30)');
  const deadlineToUse = activeTab === 'pit' ? currentDeadline : vatDeadline;
  const paymentDateToUse = activeTab === 'pit' ? paymentDate : vatPaymentDate;
  const yearThToUse = activeTab === 'pit' ? taxYearTh : vatYearTh;
  const filingMethodToUse = activeTab === 'pit' ? filingMethod : vatFilingMethod;

  // ---------- ประวัติและส่งออก Excel ----------
  const buildRecord = (label: string): HistoryRecord => {
    const isPit = activeTab === 'pit';
    const res = resultToUse;
    const penaltyRuleText = isPit
      ? (scenario === FilingScenario.VOLUNTARY
          ? 'ยื่นเอง: ไม่มีเบี้ยปรับ'
          : `เบี้ยปรับ ${res.penaltyMultiplier} เท่า เหลือเสียจริง ${res.penaltyDiscountPercent}% (ท.ป. 81/2542 ข้อ 4)`)
      : `เบี้ยปรับ ${res.penaltyMultiplier} เท่า เหลือเสียจริง ${res.penaltyDiscountPercent}% ของเบี้ยปรับตามกฎหมาย (ท.ป. 81/2542 ข้อ 5)`;
    return {
      id: newRecordId(),
      savedAt: new Date().toISOString(),
      label,
      kind: activeTab,
      taxTypeText: isPit ? 'ภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.90/91)' : 'ภาษีมูลค่าเพิ่ม (ภ.พ.30)',
      periodText: isPit ? `ปีภาษี ${taxYearTh}` : `${THAI_MONTHS_FULL[vatMonth - 1]} ${vatYearTh}`,
      methodText: filingMethodToUse === FilingMethod.ONLINE
        ? (isPit ? 'ยื่นออนไลน์' : 'ยื่นออนไลน์ (ภายในวันที่ 23 ของเดือนถัดไป)')
        : (isPit ? 'ยื่นกระดาษ' : 'ยื่นกระดาษ (ภายในวันที่ 15 ของเดือนถัดไป)'),
      scenarioText: isPit ? PIT_SCENARIO_TEXT[scenario] : VAT_SCENARIO_TEXT[vatScenario],
      penaltyRuleText,
      deadline: deadlineToUse,
      inputs: {
        filingMethod: filingMethodToUse,
        paymentDate: paymentDateToUse,
        taxOwed: res.taxOwed,
        criminalFineEntered: isPit ? parseMoney(pitCriminalFineInput) : parseMoney(vatCriminalFineInput),
        filingDate: isPit ? pitFilingArg : vatFilingArg,
        customDeadline: isPit ? pitDeadlineOverride : vatDeadlineOverride,
        ...(isPit ? {} : { vatMultiplier }),
        ...(isPit
          ? { taxYearTh, scenario, reduction }
          : { vatMonth, vatYearTh, vatScenario, vatAssessedReduction }),
      },
      estimate: isPit && taxOwedMode === 'estimate'
        ? {
            lines: estimationResult.lines.map((l) => ({ title: l.title, section: l.section, amount: l.amount, basis: l.basis, expense: l.expense, net: l.net })),
            allowances: estimationResult.allowanceItems.map((x) => ({ label: x.label, claimed: x.claimed, allowed: x.allowed, capNote: x.capNote })),
            assessableIncome: estimationResult.assessableIncome,
            totalExpenses: estimationResult.totalExpenses,
            totalAllowances: estimationResult.totalAllowances,
            netIncome: estimationResult.netIncome,
            progressiveTax: estimationResult.progressiveTax,
            minTaxBase: estimationResult.minTaxBase,
            minTax: estimationResult.minTax,
            minTaxApplies: estimationResult.minTaxApplies,
            taxTotal: estimationResult.taxTotal,
            credits: estimationResult.credits,
            additionalTax: estimationResult.additionalTax,
            refund: estimationResult.refund,
          }
        : undefined,
      result: {
        taxOwed: res.taxOwed,
        monthsLate: res.monthsLate,
        criminalFine: res.criminalFine,
        criminalFineApplies: res.criminalFineApplies,
        surcharge: res.surcharge,
        penaltyOriginal: res.penaltyOriginal,
        penaltyReduced: res.penaltyReduced,
        penaltyMultiplier: res.penaltyMultiplier,
        penaltyDiscountPercent: res.penaltyDiscountPercent,
        totalToPay: res.totalToPay,
      },
    };
  };

  const handleSaveRecord = (label: string): boolean => {
    const next = [buildRecord(label), ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    return saveHistory(next);
  };

  const handleExportCurrent = async (label: string) => {
    await exportRecordToExcel(buildRecord(label));
  };

  const handleLoadRecord = (r: HistoryRecord) => {
    const i = r.inputs;
    setActiveTab(r.kind);
    if (r.kind === 'pit') {
      if (i.taxYearTh !== undefined) setTaxYearTh(i.taxYearTh);
      if (i.scenario !== undefined) setScenario(i.scenario);
      if (i.reduction !== undefined) setReduction(i.reduction);
      setFilingMethod(i.filingMethod);
      setPaymentDate(i.paymentDate);
      setTaxOwedMode('simple');
      setTaxOwedInput(formatNumberWithCommas(String(i.taxOwed)));
      setPitCriminalFineInput(i.criminalFineEntered > 0 ? formatNumberWithCommas(String(i.criminalFineEntered)) : '');
      setPitFilingSame(!i.filingDate);
      if (i.filingDate) setPitFilingDate(i.filingDate);
      setPitCustomOn(!!i.customDeadline);
      setPitCustomDeadline(i.customDeadline || '');
    } else {
      if (i.vatMonth !== undefined) setVatMonth(i.vatMonth);
      if (i.vatYearTh !== undefined) setVatYearTh(i.vatYearTh);
      if (i.vatScenario !== undefined) setVatScenario(i.vatScenario);
      if (i.vatAssessedReduction !== undefined) setVatAssessedReduction(i.vatAssessedReduction);
      setVatFilingMethod(i.filingMethod);
      setVatPaymentDate(i.paymentDate);
      setVatOwedMode('simple');
      setVatOwedInput(formatNumberWithCommas(String(i.taxOwed)));
      setVatCriminalFineInput(i.criminalFineEntered > 0 ? formatNumberWithCommas(String(i.criminalFineEntered)) : '');
      setVatFilingSame(!i.filingDate);
      if (i.filingDate) setVatFilingDate(i.filingDate);
      setVatCustomOn(!!i.customDeadline);
      setVatCustomDeadline(i.customDeadline || '');
      setVatMultiplier(i.vatMultiplier === 1 || i.vatMultiplier === 2 ? i.vatMultiplier : 'auto');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRecord = (id: string) => {
    const next = history.filter((r) => r.id !== id);
    setHistory(next);
    saveHistory(next);
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">
      {/* ส่วนหัวของแอป (Header) */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white py-6 px-4 shadow-md shrink-0 border-b border-indigo-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-emerald-400">
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-emerald-500/20 text-emerald-400 rounded border border-emerald-400/20">
                  ตามเกณฑ์ ท.ป. 81/2542 (ฉบับ 2569)
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight mt-0.5">
                ระบบคิดค่าปรับภาษีเงินได้บุคคลธรรมดา
              </h1>
              <p className="text-xs text-slate-300 font-light mt-0.5">
                คำนวณภาษีไม่ครบ ภาษีล่าช้า เบี้ยปรับ เงินเพิ่ม และค่าปรับอาญา เพื่อความถูกต้องและรวดเร็ว
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs bg-white/5 py-2 px-3.5 rounded-xl border border-white/10">
            <div className="text-right">
              <span className="block text-slate-400 font-mono text-[10px]">วันนี้</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {formatThaiDate('2026-06-29')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ส่วนเลือกแท็บ (Tab Switcher) */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('pit')}
            className={`py-4 px-2 font-bold text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4 text-indigo-500" />
            ภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.90/91)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vat')}
            className={`py-4 px-2 font-bold text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'vat'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Percent className="w-4 h-4 text-indigo-500" />
            ภาษีมูลค่าเพิ่ม (VAT ภ.พ.30)
          </button>
        </div>
      </div>

      {/* เนื้อหาหลักของแอป (Main Content Layout) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* คอลัมน์ซ้าย: ฟอร์มกรอกข้อมูลและตั้งค่า (col-span-7) */}
        <section id="input-section" className="lg:col-span-7 space-y-6">
          {activeTab === 'pit' ? (
            <>
              {/* การตั้งค่าและเงื่อนไขการยื่น */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">1</span>
              <h2 className="text-sm font-bold text-slate-900">กำหนดปีภาษีและรูปแบบการยื่นชำระ</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ปีภาษี */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  ปีภาษี (พ.ศ.)
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={taxYearTh}
                    onChange={(e) => setTaxYearTh(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none transition-colors"
                  >
                    {TAX_YEARS.map((y) => (
                      <option key={y.yearTh} value={y.yearTh}>
                        ปีภาษี {y.yearTh} (ยื่นต้นปี {y.yearTh + 1})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* ช่องทางการยื่น */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  ช่องทางการยื่นแบบแสดงรายการ
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setFilingMethod(FilingMethod.ONLINE)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      filingMethod === FilingMethod.ONLINE
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ผ่านอินเทอร์เน็ต
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilingMethod(FilingMethod.PAPER)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                      filingMethod === FilingMethod.PAPER
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ยื่นแบบกระดาษ
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* วันสิ้นสุดกำหนดการปกติ */}
              <div className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">วันสิ้นสุดกำหนดเวลาตามกฎหมาย</span>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">
                    {formatThaiDate(currentDeadline)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-light">
                  {filingMethod === FilingMethod.ONLINE 
                    ? '* ได้สิทธิขยายเวลาการยื่นแบบออนไลน์ 8 วัน' 
                    : '* ยื่นแบบกระดาษที่สำนักงานสรรพากรพื้นที่'}
                </p>
              </div>

              {/* วันที่ชำระจริง */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    วันที่ชำระภาษีจริง / คาดว่าจะชำระ
                    <span className="text-red-500">*</span>
                  </span>
                  {calculationResult.monthsLate > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600 rounded-md border border-rose-100 animate-pulse">
                      เลยกำหนด {calculationResult.monthsLate} เดือน
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    min={currentYearConfig.paperDeadline}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <DateOptions
              idPrefix="pit"
              filingSame={pitFilingSame}
              onFilingSame={setPitFilingSame}
              filingDate={pitFilingDate}
              onFilingDate={setPitFilingDate}
              customOn={pitCustomOn}
              onCustomOn={(v) => { setPitCustomOn(v); if (v && !pitCustomDeadline) setPitCustomDeadline(pitStandardDeadline); }}
              customDeadline={pitCustomDeadline}
              onCustomDeadline={setPitCustomDeadline}
              standardDeadline={pitStandardDeadline}
            />

            <CriminalFineField
              value={pitCriminalFineInput}
              onChange={setPitCriminalFineInput}
              applies={calculationResult.criminalFineApplies}
              max={PIT_CRIMINAL_FINE_MAX}
            />

            {/* กรณีการยื่นภาษี */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-600 block">
                ลักษณะการยื่นแบบแสดงรายการ (กรณีที่ตรวจพบข้อผิดพลาด)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* ยื่นด้วยตนเอง */}
                <button
                  type="button"
                  onClick={() => setScenario(FilingScenario.VOLUNTARY)}
                  className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between h-full ${
                    scenario === FilingScenario.VOLUNTARY
                      ? 'bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-400/10'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      scenario === FilingScenario.VOLUNTARY ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      ยื่นเพิ่มเติมเอง
                    </span>
                    {scenario === FilingScenario.VOLUNTARY && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="mt-2.5">
                    <span className="block text-xs font-bold text-slate-900">สมัครใจยื่นย้อนหลัง</span>
                    <span className="block text-[10px] text-slate-500 font-light mt-0.5">
                      งดเบี้ยปรับ (0%), เสียเฉพาะเงินเพิ่ม 1.5% และค่าปรับอาญา
                    </span>
                  </div>
                </button>

                {/* โดนประเมิน (ยื่นไว้ไม่ครบ) */}
                <button
                  type="button"
                  onClick={() => setScenario(FilingScenario.ASSESSED_INCORRECT)}
                  className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between h-full ${
                    scenario === FilingScenario.ASSESSED_INCORRECT
                      ? 'bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/10'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      scenario === FilingScenario.ASSESSED_INCORRECT ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      สรรพากรประเมิน
                    </span>
                    {scenario === FilingScenario.ASSESSED_INCORRECT && <CheckCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="mt-2.5">
                    <span className="block text-xs font-bold text-slate-900">ยื่นแบบไว้แต่ไม่ครบ</span>
                    <span className="block text-[10px] text-slate-500 font-light mt-0.5">
                      เบี้ยปรับ 1 เท่า (ลดได้ไม่ต่ำกว่า 50%), เงินเพิ่ม 1.5% และค่าปรับอาญาตามที่สรรพากรแจ้ง
                    </span>
                  </div>
                </button>

                {/* โดนประเมิน (ไม่ได้ยื่นเลย) */}
                <button
                  type="button"
                  onClick={() => setScenario(FilingScenario.ASSESSED_NOT_FILED)}
                  className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between h-full ${
                    scenario === FilingScenario.ASSESSED_NOT_FILED
                      ? 'bg-rose-50/50 border-rose-400 ring-2 ring-rose-400/10'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      scenario === FilingScenario.ASSESSED_NOT_FILED ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      สรรพากรประเมิน
                    </span>
                    {scenario === FilingScenario.ASSESSED_NOT_FILED && <CheckCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div className="mt-2.5">
                    <span className="block text-xs font-bold text-slate-900">ไม่ได้ยื่นแบบเลย</span>
                    <span className="block text-[10px] text-slate-500 font-light mt-0.5">
                      เบี้ยปรับ 2 เท่า (ลดได้ไม่ต่ำกว่า 50%), เงินเพิ่ม 1.5% และค่าปรับอาญาตามที่สรรพากรแจ้ง
                    </span>
                  </div>
                </button>

              </div>
            </div>
          </div>

          {/* ส่วนระบุตัวเลขภาษีค้างชำระ */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">2</span>
                <h2 className="text-sm font-bold text-slate-900">ระบุยอดเงินภาษีที่ชำระขาด</h2>
              </div>

              {/* แท็บสลับโหมดการคำนวณ */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/30 text-xs">
                <button
                  type="button"
                  onClick={() => setTaxOwedMode('simple')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    taxOwedMode === 'simple'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  กรอกภาษีโดยตรง
                </button>
                <button
                  type="button"
                  onClick={() => setTaxOwedMode('estimate')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    taxOwedMode === 'estimate'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  ช่วยคำนวณรายได้
                </button>
              </div>
            </div>

            {/* โหมด 1: กรอกภาษีตรงๆ */}
            {taxOwedMode === 'simple' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-xs text-slate-500 font-light">
                  กรณีทราบยอดภาษีเงินได้บุคคลธรรมดาที่ต้องชำระเพิ่มเติมแล้ว (เช่น สรรพากรแจ้ง หรือประเมินได้เลขแน่ชัด) สามารถกรอกลงช่องด้านล่างได้ทันที
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    ยอดภาษีที่ต้องชำระเพิ่ม (บาท)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm font-semibold text-slate-400 font-mono">฿</span>
                    <input
                      type="text"
                      value={formatNumberWithCommas(taxOwedInput)}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/,/g, '');
                        if (cleanVal === '' || /^\d*\.?\d*$/.test(cleanVal)) {
                          setTaxOwedInput(cleanVal);
                        }
                      }}
                      placeholder="เช่น 10,000"
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-semibold text-base rounded-xl py-2.5 pl-8 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="absolute right-3.5 top-3.5 text-[10px] font-bold text-slate-400">THB</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* โหมด 2: ช่วยคำนวณภาษีที่ขาดจากรายได้ */}
            {taxOwedMode === 'estimate' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <IncomeEstimator
                  value={incomeEst}
                  result={estimationResult}
                  onChange={setIncomeEst}
                  onReset={handleResetEstimation}
                />
              </motion.div>
            )}
          </div>

          {/* ส่วนเงื่อนไขเบี้ยปรับกรณีโดนประเมินโดยเจ้าหน้าที่ */}
          <AnimatePresence>
            {scenario !== FilingScenario.VOLUNTARY && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-3 border-t border-slate-100 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-light leading-relaxed text-slate-600">
              <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px] mb-1">
                    <Building className="w-3.5 h-3.5" />
                    <span>มาตรา 35 (ค่าปรับอาญา)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    หากไม่ยื่นแบบแสดงรายการภาษีภายในเวลาที่กำหนด มีโทษปรับไม่เกิน {formatBaht(PIT_CRIMINAL_FINE_MAX, 0)} บาท
                    ขอลดค่าปรับได้ (จำนวนจริงเป็นไปตามที่เจ้าหน้าที่แจ้ง)
                  </p>
                </div>
                <a
                  href="https://www.rd.go.th/37392.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold pt-1 self-start"
                >
                  เปิดดูที่เว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] mb-1">
                    <Percent className="w-3.5 h-3.5" />
                    <span>มาตรา 27 (เงินเพิ่ม)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    ต้องรับผิดเสียเงินเพิ่มร้อยละ 1.5 ต่อเดือน (เศษของเดือนปัดเป็น 1 เดือน)
                    ของภาษีค้างชำระ สูงสุดสะสมรวมไม่เกิน 100% ของภาษีที่ค้าง (อธิบดีไม่มีอำนาจงด/ลด)
                  </p>
                </div>
                <a
                  href="http://rd.go.th/562.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 font-semibold pt-1 self-start"
                >
                  เปิดดูที่เว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                การลดเบี้ยปรับ (ม. 22 / ม. 26) ตามดุลพินิจเจ้าพนักงานประเมิน
              </label>
              <p className="text-[11px] text-slate-500 font-light leading-relaxed">
                ตามคำสั่งกรมสรรพากร ท.ป. 81/2542 ข้อ 4 เจ้าพนักงานประเมินลดเบี้ยปรับภาษีเงินได้ได้ตามดุลพินิจ
                แต่ต้องให้เสียไม่น้อยกว่า 50% ของเบี้ยปรับ (ไม่มีตารางลดตามช่วงวันที่ชำระ)
                และต้องยื่นคำร้องขอลดก่อนมีหนังสือแจ้งการประเมิน
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setReduction(PenaltyReduction.NO_REDUCTION)}
                  className={`p-3 text-left rounded-xl border flex items-center justify-between transition-all ${
                    reduction === PenaltyReduction.NO_REDUCTION
                      ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold">ยังไม่ได้รับการลด (เต็ม 100%)</span>
                    <span className="block text-[10px] text-slate-400 font-light">
                      ยอดสูงสุดตามกฎหมาย ใช้เป็นกรณีเลวร้ายที่สุด
                    </span>
                  </div>
                  {reduction === PenaltyReduction.NO_REDUCTION && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setReduction(PenaltyReduction.REDUCED_50)}
                  className={`p-3 text-left rounded-xl border flex items-center justify-between transition-all ${
                    reduction === PenaltyReduction.REDUCED_50
                      ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold">ได้รับอนุมัติลดสูงสุด (เหลือ 50%)</span>
                    <span className="block text-[10px] text-slate-400 font-light">
                      เจ้าพนักงานอนุมัติลดเต็มที่ตามข้อ 4
                    </span>
                  </div>
                  {reduction === PenaltyReduction.REDUCED_50 && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>
              </div>
            </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* อ้างอิงทางกฎหมาย */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-800">
                <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">เอกสารและข้อกฎหมายอ้างอิง</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-light">อ้างอิงตรงจากประมวลรัษฎากร</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-light leading-relaxed text-slate-600">
              <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px] mb-1">
                    <Building className="w-3.5 h-3.5" />
                    <span>มาตรา 35 (ค่าปรับอาญา)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    หากไม่ยื่นแบบแสดงรายการภาษีภายในเวลาที่กำหนด มีโทษปรับไม่เกิน {formatBaht(PIT_CRIMINAL_FINE_MAX, 0)} บาท
                    ขอลดค่าปรับได้ (จำนวนจริงเป็นไปตามที่เจ้าหน้าที่แจ้ง)
                  </p>
                </div>
                <a
                  href="https://www.rd.go.th/37392.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold pt-1 self-start"
                >
                  เปิดดูที่เว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] mb-1">
                    <Percent className="w-3.5 h-3.5" />
                    <span>มาตรา 27 (เงินเพิ่ม)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    ต้องรับผิดเสียเงินเพิ่มร้อยละ 1.5 ต่อเดือน (เศษของเดือนปัดเป็น 1 เดือน) 
                    ของภาษีค้างชำระ สูงสุดสะสมรวมไม่เกิน 100% ของภาษีที่ค้าง (อธิบดีไม่มีอำนาจงด/ลด)
                  </p>
                </div>
                <a
                  href="http://rd.go.th/562.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 font-semibold pt-1 self-start"
                >
                  เปิดดูที่เว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
            </>
          ) : (
            <>
              {/* ============================================== */}
              {/* แผงควบคุมฝั่ง VAT (Value Added Tax) */}
              {/* ============================================== */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 animate-fadeIn">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">1</span>
                  <h2 className="text-sm font-bold text-slate-900">กำหนดเดือน/ปีภาษี และช่องทางยื่นแบบ</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* เดือนภาษี */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      เดือนภาษี
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={vatMonth}
                        onChange={(e) => setVatMonth(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none transition-colors"
                      >
                        {[
                          'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                          'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                        ].map((m, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* ปีภาษี (พ.ศ.) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      ปีภาษี (พ.ศ.)
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={vatYearTh}
                        onChange={(e) => setVatYearTh(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none transition-colors"
                      >
                        {[2569, 2568, 2567, 2566, 2565].map((year) => (
                          <option key={year} value={year}>
                            พ.ศ. {year}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* ช่องทางการยื่น */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">
                      ช่องทางการยื่นแบบแสดงรายการ
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setVatFilingMethod(FilingMethod.ONLINE)}
                        className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                          vatFilingMethod === FilingMethod.ONLINE
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ผ่านเน็ต (วันที่ 23)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVatFilingMethod(FilingMethod.PAPER)}
                        className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                          vatFilingMethod === FilingMethod.PAPER
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ยื่นกระดาษ (วันที่ 15)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* วันสิ้นสุดกำหนดการปกติ */}
                  <div className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">วันสิ้นสุดกำหนดเวลาปกติตามกฎหมาย</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">
                        {formatThaiDate(vatDeadline)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-light">
                      {vatFilingMethod === FilingMethod.ONLINE 
                        ? '* ได้สิทธิขยายเวลาการยื่นแบบออนไลน์ 8 วัน (ภายในวันที่ 23 ของเดือนถัดไป)' 
                        : '* ยื่นแบบกระดาษ (ภายในวันที่ 15 ของเดือนถัดไป)'}
                    </p>
                  </div>

                  {/* วันที่ชำระจริง */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        วันที่คาดว่าจะชำระภาษีจริง
                        <span className="text-red-500">*</span>
                      </span>
                      {vatCalculationResult.monthsLate > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600 rounded-md border border-rose-100 animate-pulse">
                          เลยกำหนด {vatCalculationResult.monthsLate} เดือน
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={vatPaymentDate}
                        onChange={(e) => setVatPaymentDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DateOptions
                idPrefix="vat"
                filingSame={vatFilingSame}
                onFilingSame={setVatFilingSame}
                filingDate={vatFilingDate}
                onFilingDate={setVatFilingDate}
                customOn={vatCustomOn}
                onCustomOn={(v) => { setVatCustomOn(v); if (v && !vatCustomDeadline) setVatCustomDeadline(vatStandardDeadline); }}
                customDeadline={vatCustomDeadline}
                onCustomDeadline={setVatCustomDeadline}
                standardDeadline={vatStandardDeadline}
              />

              <CriminalFineField
                value={vatCriminalFineInput}
                onChange={setVatCriminalFineInput}
                applies={vatCalculationResult.criminalFineApplies}
                max={null}
              />

              {/* ยอดเงินภาษีค้างชำระของ VAT */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">2</span>
                    <h2 className="text-sm font-bold text-slate-900">ระบุยอดภาษีมูลค่าเพิ่มค้างชำระ (VAT Owed)</h2>
                  </div>

                  {/* แท็บสลับโหมดการคำนวณของ VAT */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/30 text-xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setVatOwedMode('simple')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        vatOwedMode === 'simple'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      กรอกภาษีโดยตรง
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatOwedMode('estimate')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        vatOwedMode === 'estimate'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      ช่วยคำนวณภาษี (VAT)
                    </button>
                  </div>
                </div>

                {/* โหมด 1: กรอกภาษีตรงๆ */}
                {vatOwedMode === 'simple' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-slate-500 font-light">
                      กรณีทราบยอดภาษีมูลค่าเพิ่มที่ชำระขาด/ยื่นเพิ่มเติมแล้ว สามารถกรอกยอดลงช่องด้านล่างได้ทันที
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">
                        จำนวนภาษีมูลค่าเพิ่มที่ต้องชำระเพิ่ม <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-sm text-slate-400 font-semibold font-mono">฿</span>
                        <input
                          type="text"
                          value={vatOwedInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '');
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setVatOwedInput(formatNumberWithCommas(val));
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 text-base font-extrabold rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-light">
                        * ยอดเงินภาษีมูลค่าเพิ่มที่ไม่ได้ยื่นหรือยื่นขาด (ไม่รวมยอดขาย)
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* โหมด 2: ช่วยคำนวณภาษีมูลค่าเพิ่มค้างชำระ (VAT Owed Estimate) */}
                {vatOwedMode === 'estimate' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-start gap-2 text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-indigo-900 block">โปรแกรมช่วยประเมินและคำนวณภาษีมูลค่าเพิ่ม (ภ.พ.30)</span>
                        <p className="text-indigo-800 font-light leading-relaxed">
                          คำนวณหาภาษีที่ต้องชำระเพิ่มจากสูตร: <strong className="font-bold">ภาษีขาย (Output VAT) - ภาษีซื้อ (Input VAT)</strong> โดยสามารถเลือกคำนวณอัตโนมัติที่อัตราร้อยละ 7 หรือระบุยอดภาษีโดยตรง
                        </p>
                      </div>
                    </div>

                    {/* เลือกอัตราและวิธีคำนวณภาษี */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-700">การหาค่าภาษีมูลค่าเพิ่ม (ภาษีขาย/ภาษีซื้อ)</span>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="vat_calc_method"
                            checked={vatUseAuto === true}
                            onChange={() => setVatUseAuto(true)}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span>คำนวณให้ 7% อัตโนมัติ</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="vat_calc_method"
                            checked={vatUseAuto === false}
                            onChange={() => setVatUseAuto(false)}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span>ระบุยอดภาษีเอง</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ยอดขาย และ ภาษีขาย */}
                      <div className="space-y-3 p-3 bg-slate-50/40 border border-slate-100 rounded-xl">
                        <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 border-b border-indigo-100/50 pb-1.5 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          ส่วนภาษีขาย (Output VAT)
                        </h3>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">
                            ยอดขาย/รายรับทั้งเดือนที่ต้องเสียภาษี
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">฿</span>
                            <input
                              type="text"
                              value={formatNumberWithCommas(vatSalesInput)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/,/g, '');
                                if (cleanVal === '' || /^\d*\.?\d*$/.test(cleanVal)) {
                                  setVatSalesInput(cleanVal);
                                }
                              }}
                              className="w-full bg-white border border-slate-200 text-xs rounded-lg py-1.5 pl-6 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block flex justify-between">
                            <span>ยอดเงินภาษีขาย (Output VAT)</span>
                            {vatUseAuto && <span className="text-[9px] text-indigo-600 font-normal bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">(คำนวณ 7%)</span>}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">฿</span>
                            <input
                              type="text"
                              disabled={vatUseAuto}
                              value={vatUseAuto ? formatNumberWithCommas(vatEstimationResult.outputVat) : formatNumberWithCommas(vatOutputVatInput)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/,/g, '');
                                if (cleanVal === '' || /^\d*\.?\d*$/.test(cleanVal)) {
                                  setVatOutputVatInput(cleanVal);
                                }
                              }}
                              className={`w-full text-xs rounded-lg py-1.5 pl-6 pr-4 focus:outline-none font-semibold ${
                                vatUseAuto 
                                  ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed' 
                                  : 'bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-800'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ยอดซื้อ และ ภาษีซื้อ */}
                      <div className="space-y-3 p-3 bg-slate-50/40 border border-slate-100 rounded-xl">
                        <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100/50 pb-1.5 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          ส่วนภาษีซื้อ (Input VAT)
                        </h3>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">
                            ยอดซื้อ/รายจ่ายทั้งเดือนที่มีใบกำกับภาษีถูกต้อง
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">฿</span>
                            <input
                              type="text"
                              value={formatNumberWithCommas(vatPurchasesInput)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/,/g, '');
                                if (cleanVal === '' || /^\d*\.?\d*$/.test(cleanVal)) {
                                  setVatPurchasesInput(cleanVal);
                                }
                              }}
                              className="w-full bg-white border border-slate-200 text-xs rounded-lg py-1.5 pl-6 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block flex justify-between">
                            <span>ยอดเงินภาษีซื้อที่ใช้สิทธิ์ได้ (Input VAT)</span>
                            {vatUseAuto && <span className="text-[9px] text-emerald-600 font-normal bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">(คำนวณ 7%)</span>}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">฿</span>
                            <input
                              type="text"
                              disabled={vatUseAuto}
                              value={vatUseAuto ? formatNumberWithCommas(vatEstimationResult.inputVat) : formatNumberWithCommas(vatInputVatInput)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/,/g, '');
                                if (cleanVal === '' || /^\d*\.?\d*$/.test(cleanVal)) {
                                  setVatInputVatInput(cleanVal);
                                }
                              }}
                              className={`w-full text-xs rounded-lg py-1.5 pl-6 pr-4 focus:outline-none font-semibold ${
                                vatUseAuto 
                                  ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed' 
                                  : 'bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-800'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* สรุปข้อมูลการประเมิน VAT Owed */}
                    <div className="flex flex-col md:flex-row justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 gap-3">
                      <div className="text-left space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">สมการภาษีมูลค่าเพิ่มที่ต้องชำระ (ภ.พ.30)</span>
                        <div className="text-xs text-slate-600">
                          ภาษีขาย <strong>฿{formatBaht(vatEstimationResult.outputVat)}</strong> - ภาษีซื้อ <strong>฿{formatBaht(vatEstimationResult.inputVat)}</strong>
                        </div>
                      </div>

                      <div className="text-center md:text-right space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-medium block">ประเมินภาษีมูลค่าเพิ่มค้างชำระสุทธิ</span>
                        <div className="text-lg font-extrabold text-indigo-700 font-mono">
                          ฿{formatBaht(vatEstimationResult.netVatOwed)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleResetVatEstimation}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2.5 rounded-lg border border-slate-200/80 bg-white cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        รีเซ็ตค่าประเมิน
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* เงื่อนไขลักษณะการยื่นและอัตราเบี้ยปรับของ VAT */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">3</span>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-900">ระบุลักษณะความรับผิด และตัวคูณเบี้ยปรับ</h2>
                    <span className="px-1.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 font-bold rounded">ภ.พ.30</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* 1. สมัครใจยื่นเพิ่มเติม */}
                  <button
                    type="button"
                    onClick={() => setVatScenario('voluntary_additional')}
                    className={`p-3.5 text-left rounded-xl border flex flex-col justify-between transition-all gap-1.5 ${
                      vatScenario === 'voluntary_additional'
                        ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold">1. สมัครใจยื่นเพิ่มเติม</span>
                      {vatScenario === 'voluntary_additional' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-light leading-relaxed">
                      เคยยื่นแบบไว้แล้วแต่ไม่ครบถ้วน สมัครใจยื่นแบบเพิ่มเติมด้วยตัวเอง <strong>(เบี้ยปรับ 1 เท่า ลดเหลือ 2% - 20% ของเบี้ยปรับ ตามจำนวนวันที่ช้า)</strong>
                    </p>
                  </button>

                  {/* 2. สมัครใจยื่นช้า */}
                  <button
                    type="button"
                    onClick={() => setVatScenario('voluntary_late')}
                    className={`p-3.5 text-left rounded-xl border flex flex-col justify-between transition-all gap-1.5 ${
                      vatScenario === 'voluntary_late'
                        ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold">2. สมัครใจยื่นล่าช้า (ไม่เคยยื่น)</span>
                      {vatScenario === 'voluntary_late' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-light leading-relaxed">
                      ไม่เคยยื่นแบบรายเดือนนั้นมาก่อน สมัครใจเข้ายื่นแบบย้อนหลังล่าช้าด้วยตัวเอง <strong>(เบี้ยปรับ 2 เท่า ลดเหลือ 2% - 20% ของเบี้ยปรับ = 4% - 40% ของภาษี)</strong>
                    </p>
                  </button>

                  {/* 3. เจ้าหน้าที่ตรวจสอบพบ (ยื่นขาด) */}
                  <button
                    type="button"
                    onClick={() => setVatScenario('assessed_incorrect')}
                    className={`p-3.5 text-left rounded-xl border flex flex-col justify-between transition-all gap-1.5 ${
                      vatScenario === 'assessed_incorrect'
                        ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold">3. เจ้าหน้าที่ประเมิน (ยื่นขาด)</span>
                      {vatScenario === 'assessed_incorrect' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-light leading-relaxed">
                      เคยยื่นไว้ไม่ครบถ้วน จนกระทั่งถูกสรรพากรตรวจสอบพบและมีหนังสือประเมินภาษี <strong>(เบี้ยปรับ 1 เท่า เต็มอัตรา หรือลดเหลือ 40%/50% ตามดุลพินิจ)</strong>
                    </p>
                  </button>

                  {/* 4. เจ้าหน้าที่ตรวจสอบพบ (ไม่ได้ยื่นแบบ) */}
                  <button
                    type="button"
                    onClick={() => setVatScenario('assessed_not_filed')}
                    className={`p-3.5 text-left rounded-xl border flex flex-col justify-between transition-all gap-1.5 ${
                      vatScenario === 'assessed_not_filed'
                        ? 'border-indigo-500 bg-indigo-50/20 text-indigo-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold">4. เจ้าหน้าที่ประเมิน (ไม่ได้ยื่นแบบ)</span>
                      {vatScenario === 'assessed_not_filed' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-light leading-relaxed">
                      ไม่ได้ยื่นแบบแสดงรายการเลยจนถูกตรวจพบ และมีหนังสือประเมินภาษีย้อนหลัง <strong>(เบี้ยปรับ 2 เท่า เต็มอัตรา หรือลดเหลือ 40%/50% ของเบี้ยปรับ ตามดุลพินิจ)</strong>
                    </p>
                  </button>
                </div>

                {/* ตารางลดเบี้ยปรับกรณียื่นพร้อมชำระเองโดยไม่ได้รับคำเตือน (ท.ป. 81/2542 ข้อ 5(1)) */}
                {(vatScenario === 'voluntary_additional' || vatScenario === 'voluntary_late') && (
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2.5 text-xs text-indigo-950">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>เกณฑ์ลดเบี้ยปรับตามระยะเวลาล่าช้า (ยื่นพร้อมชำระเอง ไม่เคยได้รับคำเตือน):</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium font-mono">
                      {[
                        { label: 'ช้า 1-15 วัน', pct: 2 },
                        { label: 'ช้า 16-30 วัน', pct: 5 },
                        { label: 'ช้า 31-60 วัน', pct: 10 },
                        { label: 'ช้าเกิน 60 วัน', pct: 20 },
                      ].map((tier) => (
                        <div key={tier.label} className="p-2 bg-white rounded-lg border border-indigo-100/60 shadow-xs">
                          <span className="block text-slate-500 font-sans text-[10px] font-normal">{tier.label}</span>
                          <span className="block font-bold text-indigo-700">เหลือ {tier.pct}%</span>
                          <span className="block text-slate-400 font-sans text-[9px] font-normal">
                            {vatScenario === 'voluntary_late' ? `ของเบี้ยปรับ (= ${tier.pct * 2}% ของภาษี)` : `ของเบี้ยปรับ (= ${tier.pct}% ของภาษี)`}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-indigo-700/80 font-light leading-normal">
                      💡 <em>อ้างอิง {LEGAL_BASIS.directive} ข้อ 5(1) เปอร์เซ็นต์คิดจากเบี้ยปรับตามกฎหมาย ไม่ใช่จากยอดภาษี และใช้เมื่อยื่นแบบพร้อมชำระโดยไม่เคยได้รับคำเตือนหรือคำเรียกตรวจสอบเป็นหนังสือ</em>
                    </p>
                  </div>
                )}

                {/* กรณีถูกประเมิน: ลดเหลือ 40%/50% ตามดุลพินิจ (ข้อ 5(2)-(3)) */}
                {(vatScenario === 'assessed_incorrect' || vatScenario === 'assessed_not_filed') && (
                  <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2.5 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>การลดเบี้ยปรับกรณีถูกประเมิน (ตามดุลพินิจเจ้าพนักงาน)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { value: 'NONE', title: 'ไม่ได้รับการลด', sub: 'เต็ม 100% ของเบี้ยปรับ' },
                        { value: 'PCT_40', title: 'เหลือ 40%', sub: 'ยื่นภายในกำหนดตามหนังสือ / พบภายใน 1 ปีหลังจดทะเบียน' },
                        { value: 'PCT_50', title: 'เหลือ 50%', sub: 'ยื่นเลยกำหนดตามหนังสือ / พบหลัง 1 ปีหลังจดทะเบียน' },
                      ] as { value: VatAssessedReduction; title: string; sub: string }[]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setVatAssessedReduction(opt.value)}
                          className={`p-2.5 text-left rounded-xl border transition-all ${
                            vatAssessedReduction === opt.value
                              ? 'border-indigo-500 bg-indigo-50/30 text-indigo-950'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="flex items-center justify-between text-xs font-bold">
                            {opt.title}
                            {vatAssessedReduction === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-light leading-snug">{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 font-light leading-normal">
                      อ้างอิง {LEGAL_BASIS.directive} ข้อ 5(2)-(3) ต้องยื่นคำร้องขอลดก่อนมีหนังสือแจ้งการประเมิน
                      ค่าเริ่มต้นคือไม่ลด เพื่อแสดงยอดสูงสุดตามกฎหมาย
                    </p>
                  </div>
                )}

                {/* เบี้ยปรับตามกฎหมายกี่เท่า: ให้ตรงกับหนังสือประเมิน */}
                <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl space-y-2.5 text-xs text-slate-700">
                  <span className="font-bold text-slate-800 block">เบี้ยปรับตามกฎหมาย กี่เท่าของภาษี</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'auto', title: `ตามที่ระบบเลือก (${vatScenario === 'voluntary_additional' || vatScenario === 'assessed_incorrect' ? 1 : 2} เท่า)` },
                      { value: 1, title: '1 เท่า' },
                      { value: 2, title: '2 เท่า' },
                    ] as { value: 'auto' | 1 | 2; title: string }[]).map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setVatMultiplier(opt.value)}
                        className={`p-2 text-center rounded-xl border text-[11px] font-semibold transition-all ${
                          vatMultiplier === opt.value
                            ? 'border-indigo-500 bg-indigo-50/30 text-indigo-950'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {opt.title}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-light leading-normal">
                    เบี้ยปรับ ภ.พ.30 ขึ้นกับมาตราที่เจ้าพนักงานใช้ เช่น ม.89(2) คิด 2 เท่า หรือ ม.89(4) คิด 1 เท่าของรายการที่คลาดเคลื่อน
                    ตัวอย่างของกรมสรรพากรแสดงว่าบางกรณีต้องเทียบหลายมาตรา ผลลัพธ์นี้จึงเป็นการประมาณการ
                    ถ้ามีหนังสือแจ้งการประเมิน ให้เลือกจำนวนเท่าตามหนังสือและยึดยอดที่สรรพากรแจ้งเป็นหลัก
                  </p>
                </div>
              </div>

              {/* อ้างอิงทางกฎหมายของ VAT */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">เอกสารและระเบียบกรมสรรพากรที่เกี่ยวข้อง</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-light font-mono">Official Resources</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-light leading-relaxed text-slate-600">
                  <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px] mb-1">
                        <Building className="w-3.5 h-3.5" />
                        <span>ตัวอย่างการคำนวณเบี้ยปรับและเงินเพิ่ม ภ.พ.30</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        ตัวอย่างจากกรมสรรพากร แสดงวิธีคิดเบี้ยปรับตามมาตรา 89(2), 89(3), 89(4) และเงินเพิ่มตามมาตรา 89/1
                      </p>
                    </div>
                    <a
                      href="https://www.rd.go.th/9880.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold pt-1 self-start"
                    >
                      เปิดตัวอย่างที่ 1 บนเว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] mb-1">
                        <Percent className="w-3.5 h-3.5" />
                        <span>ตัวอย่างการคำนวณ (ต่อ)</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        ตัวอย่างการยื่น ภ.พ.30 ทันกำหนดแล้วแก้ไขภายหลัง หรือถูกประเมิน พร้อมวิธีคิดเบี้ยปรับ 1 เท่า / 2 เท่า และเงินเพิ่ม 1.5% ต่อเดือน
                      </p>
                    </div>
                    <a
                      href="https://www.rd.go.th/9881.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-800 font-semibold pt-1 self-start"
                    >
                      เปิดตัวอย่างที่ 2 บนเว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="space-y-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>ท.ป. 81/2542 (งด/ลดเบี้ยปรับ)</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        เกณฑ์งดหรือลดเบี้ยปรับ ภาษีเงินได้ ภ.พ.30 และภาษีธุรกิจเฉพาะ (ฉบับแก้ไขโดย ท.ป. 369/2569) เช่น ยื่นเองลดเหลือ 2% - 20% ของเบี้ยปรับ
                      </p>
                    </div>
                    <a
                      href="https://www.rd.go.th/3361.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold pt-1 self-start"
                    >
                      เปิดคำสั่งบนเว็บสรรพากร <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* คอลัมน์ขวา: ผลการคำนวณและกราฟ (col-span-5) */}
        <section id="results-section" className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
          
          {/* กล่องสรุปผลแบบบิ๊กๆ */}
          <div className="bg-gradient-to-b from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-indigo-950 space-y-5 animate-fadeIn">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-200">ยอดรวมทั้งหมดที่ต้องชำระ</span>
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight font-mono text-emerald-400 mt-1">
                  <AnimatedNumber value={resultToUse.totalToPay} prefix="฿" decimals={2} />
                </div>
              </div>
              <div className="px-2.5 py-1 bg-white/10 rounded-xl text-right shrink-0 border border-white/5">
                <span className="block text-[9px] text-slate-300 font-light">ค่าปรับและเงินเพิ่มรวม</span>
                <span className="text-xs font-bold text-rose-400 font-mono">
                  + <AnimatedNumber value={resultToUse.totalPenaltiesAndSurcharges} prefix="฿" />
                </span>
              </div>
            </div>

            {/* แถบสรุปแจกแจงแบบกวาดสายตา */}
            <div className="grid grid-cols-2 gap-2 bg-black/20 p-3 rounded-xl border border-white/5 text-xs font-mono">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-light block">ภาษีที่ค้างชำระ:</span>
                <span className="text-slate-200 font-semibold">
                  <AnimatedNumber value={resultToUse.taxOwed} prefix="฿" />
                </span>
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-slate-400 font-light block">ค่าปรับอาญา:</span>
                <span className="text-indigo-300 font-semibold">
                  <AnimatedNumber value={resultToUse.criminalFine} prefix="฿" />
                </span>
                {resultToUse.criminalFineApplies && resultToUse.criminalFine === 0 && (
                  <span className="block text-[9px] text-amber-300 font-light">ยังไม่รวมในยอด (กรอกที่ช่องค่าปรับอาญา)</span>
                )}
              </div>
            </div>

            {/* แสดงส่วนต่างกรณีได้รับความคุ้มครองยื่นเอง */}
            {isVoluntaryResult ? (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/25 rounded-xl flex items-start gap-2 text-xs animate-fadeIn">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-emerald-100">
                  <span className="font-bold text-white block">
                    {resultToUse.penaltyOriginal === 0 ? 'ยื่นเอง ไม่มีเบี้ยปรับ' : 'ยื่นเอง ได้รับการลดเบี้ยปรับ'}
                  </span>
                  <p className="font-light leading-relaxed text-[11px]">
                    {resultToUse.penaltyOriginal === 0 ? (
                      <>ภาษีเงินได้บุคคลธรรมดาที่ยื่นเอง (ก่อนถูกเรียกตรวจ) ไม่มีเบี้ยปรับ เสียเฉพาะเงินเพิ่มและค่าปรับอาญา (ถ้ามี)</>
                    ) : (
                      <>
                        เบี้ยปรับเต็มตามกฎหมายคือ <AnimatedNumber value={resultToUse.penaltyOriginal} prefix="฿" className="font-semibold" /> ลดเหลือ {resultToUse.penaltyDiscountPercent}% จึงจ่าย{' '}
                        <strong className="text-emerald-400"><AnimatedNumber value={resultToUse.penaltyReduced} prefix="฿" /></strong>{' '}
                        (ประหยัดได้ <AnimatedNumber value={resultToUse.penaltyOriginal - resultToUse.penaltyReduced} prefix="฿" />)
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-500/15 border border-rose-500/25 rounded-xl flex items-start gap-2 text-xs animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-rose-100">
                  <span className="font-bold text-white block">
                    {resultToUse.penaltyDiscountPercent >= 100 ? 'มีเบี้ยปรับเต็มอัตราจากการประเมิน' : 'มีเบี้ยปรับจากการประเมิน (หลังได้รับการลด)'}
                  </span>
                  <p className="font-light leading-relaxed text-[11px]">
                    เจ้าหน้าที่ตรวจพบและประเมินภาษี เบี้ยปรับที่ต้องจ่ายคือ <strong className="text-rose-400"><AnimatedNumber value={resultToUse.penaltyReduced} prefix="฿" /></strong>
                    ({resultToUse.penaltyMultiplier} เท่าของภาษี{resultToUse.penaltyDiscountPercent < 100 ? ` ลดเหลือ ${resultToUse.penaltyDiscountPercent}%` : ' ยังไม่ได้รับการลด'})
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* กราฟเปรียบเทียบสัดส่วนภาษี */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 block">กราฟฟิกแสดงสัดส่วนโครงสร้างหนี้ภาษี</span>
              <span className="text-[10px] text-slate-400 font-light font-mono">Interactive Chart</span>
            </div>
            
            <TaxDonutChart
              tax={resultToUse.taxOwed}
              surcharge={resultToUse.surcharge}
              criminalFine={resultToUse.criminalFine}
              penalty={resultToUse.penaltyReduced}
            />
          </div>

          {/* รายละเอียดบิลค่าปรับแบบชำแหละ */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">แจกแจงสูตรคำนวณอย่างย่อ</h3>
            </div>

            <div className="space-y-3 text-xs">
              
              {/* รายการ 1: ภาษีหลัก */}
              <div className="flex justify-between items-start py-1 border-b border-slate-100/60 last:border-0">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">1. ภาษีค้างชำระหลัก</span>
                  <span className="text-[10px] text-slate-400 font-light leading-tight block">
                    ยอดเงินภาษีที่จ่ายไม่ครบถ้วนตามความจริง
                  </span>
                </div>
                <span className="font-semibold text-slate-800 font-mono">
                  <AnimatedNumber value={resultToUse.taxOwed} prefix="฿" />
                </span>
              </div>

              {/* รายการ 2: ค่าปรับอาญา */}
              <div className="flex justify-between items-start py-1 border-b border-slate-100/60 last:border-0">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">2. ค่าปรับอาญา (ล่าช้า)</span>
                  <span className="text-[10px] text-slate-400 font-light leading-tight block">
                    {!resultToUse.criminalFineApplies
                      ? 'ยื่นในเวลาปกติ (ไม่มีค่าปรับ)'
                      : resultToUse.criminalFine > 0
                        ? `ตามที่สรรพากรแจ้ง${resultToUse.criminalFineMax !== null ? ` (ไม่เกิน ${formatBaht(resultToUse.criminalFineMax, 0)} บาทตาม ม.35)` : ''}`
                        : `ยังไม่รวมในยอด: กรอกจำนวนที่สรรพากรแจ้งในช่องค่าปรับอาญา${resultToUse.criminalFineMax !== null ? ` (ไม่เกิน ${formatBaht(resultToUse.criminalFineMax, 0)} บาท)` : ''}`}
                  </span>
                </div>
                <span className="font-semibold text-indigo-600 font-mono">
                  <AnimatedNumber value={resultToUse.criminalFine} prefix="฿" />
                </span>
              </div>

              {/* รายการ 3: เงินเพิ่ม */}
              <div className="flex justify-between items-start py-1 border-b border-slate-100/60 last:border-0">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">3. เงินเพิ่ม ({activeTab === 'pit' ? 'ม. 27' : 'ม. 89/1'})</span>
                  <span className="text-[10px] text-slate-400 font-light leading-tight block">
                    {resultToUse.monthsLate === 0 
                      ? 'ไม่มีเงินเพิ่ม' 
                      : `คิด 1.5% ต่อเดือน x ${resultToUse.monthsLate} เดือน = ${(1.5 * resultToUse.monthsLate).toFixed(1)}%`}
                    {resultToUse.surcharge === resultToUse.taxOwed && ' (เต็มเพดานสูงสุด 100% ของตัวภาษีแล้ว)'}
                  </span>
                </div>
                <span className="font-semibold text-amber-600 font-mono">
                  <AnimatedNumber value={resultToUse.surcharge} prefix="฿" />
                </span>
              </div>

              {/* รายการ 4: เบี้ยปรับ */}
              <div className="flex justify-between items-start py-1 border-b border-slate-100/60 last:border-0">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 block">4. ค่าเบี้ยปรับ ({activeTab === 'pit' ? 'ม. 22' : 'ม. 89'})</span>
                  <span className="text-[10px] text-slate-400 font-light leading-tight block">
                    {activeTab === 'pit'
                      ? (scenario === FilingScenario.VOLUNTARY
                          ? 'ยื่นเพิ่มเติมด้วยตนเอง: งดเว้นเบี้ยปรับ (0%)'
                          : `คิดจากยอดประเมิน ${resultToUse.penaltyMultiplier} เท่า ${resultToUse.penaltyDiscountPercent < 100 ? `ลดเหลือ ${resultToUse.penaltyDiscountPercent}%` : '(ยังไม่ได้รับการลด)'}`)
                      : (isVoluntaryResult
                          ? `ยื่นเองล่าช้า: ${resultToUse.penaltyMultiplier} เท่าของภาษี ลดเหลือ ${resultToUse.penaltyDiscountPercent}% ของเบี้ยปรับตามกฎหมาย (ท.ป. 81/2542 ข้อ 5)`
                          : `คิดจากการตรวจประเมิน ${resultToUse.penaltyMultiplier} เท่าของภาษี ${resultToUse.penaltyDiscountPercent < 100 ? `ลดเหลือ ${resultToUse.penaltyDiscountPercent}%` : '(ยังไม่ได้รับการลด)'}`)
                    }
                  </span>
                </div>
                <span className="font-semibold text-rose-600 font-mono">
                  <AnimatedNumber value={resultToUse.penaltyReduced} prefix="฿" />
                </span>
              </div>

            </div>

            <details className="group bg-slate-50/60 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
              <summary className="cursor-pointer font-semibold text-slate-700 select-none">
                อ่านผลลัพธ์อย่างไร (ความหมายของแต่ละรายการ)
              </summary>
              <dl className="mt-2 space-y-1.5 font-light">
                <div>
                  <dt className="inline font-semibold text-slate-700">ภาษีที่ค้างชำระ </dt>
                  <dd className="inline">คือภาษีที่ต้องจ่ายเพิ่มตามจริง (ยังไม่รวมค่าปรับใดๆ)</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-700">เงินเพิ่ม </dt>
                  <dd className="inline">คล้ายดอกเบี้ยตามกฎหมาย 1.5% ต่อเดือน นับจากวันครบกำหนดจนถึงวันที่จ่าย (เศษของเดือนนับเป็น 1 เดือน) และรวมกันไม่เกินยอดภาษี</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-700">เบี้ยปรับ </dt>
                  <dd className="inline">โทษทางภาษีเมื่อยื่นไม่ครบหรือไม่ยื่น คิดเป็น 1 เท่าหรือ 2 เท่าของภาษี และมีสิทธิ์ขอลดได้ตามเงื่อนไข ภาษีเงินได้บุคคลธรรมดาที่ยื่นเองไม่มีเบี้ยปรับ</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-slate-700">ค่าปรับอาญา </dt>
                  <dd className="inline">ค่าปรับเพื่อระงับคดีอาญา เมื่อยื่นแบบล่าช้า จำนวนจริงตามที่เจ้าหน้าที่สรรพากรแจ้ง (ภ.ง.ด. ไม่เกิน 2,000 บาท) จึงให้กรอกเองในช่องด้านซ้าย</dd>
                </div>
              </dl>
            </details>

            <p className="text-[10px] text-slate-400 font-light leading-relaxed">
              ผลลัพธ์เป็นการประมาณการ การลดเบี้ยปรับเป็นดุลพินิจของเจ้าพนักงานและมีเงื่อนไขตามคำสั่งกรมสรรพากร
              อ้างอิง {LEGAL_BASIS.directive}{' '}
              <a href={LEGAL_BASIS.url} target="_blank" rel="noopener noreferrer" className="underline">
                ดูที่เว็บสรรพากร
              </a>{' '}
              (ตรวจสอบล่าสุด {LEGAL_BASIS.checkedOn}) ควรยืนยันกับเจ้าหน้าที่ก่อนชำระจริง
            </p>

            <SaveExportBar onSave={handleSaveRecord} onExport={handleExportCurrent} />

            {/* เครื่องมือจัดการข้อมูลและพิมพ์รายงาน */}
            <div className="pt-3 border-t border-slate-100/80 no-print">
              <button
                type="button"
                onClick={handleCopySummary}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-indigo-700 border-indigo-100 hover:bg-indigo-50/50 hover:border-indigo-200 shadow-sm'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'คัดลอกสำเร็จ!' : 'คัดลอกสรุปข้อความ'}
              </button>
            </div>

            {/* ปุ่มเปิดความรู้ภาษีเพิ่มเติม */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowFormulaInfo(!showFormulaInfo)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 hover:text-slate-800 text-[11px] font-semibold transition-colors"
              >
                <span>💡 วิธีการและสูตรคำนวณเบื้องหลัง</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${showFormulaInfo ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {showFormulaInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-slate-50/50 p-3 rounded-b-xl border-x border-b border-slate-100 text-[10px] text-slate-500 space-y-2 leading-relaxed"
                  >
                    <p>
                      <strong>ภาษีที่ต้องชำระ</strong>: คิดเงินได้สุทธิ = รายได้ทั้งปี - ค่าใช้จ่าย - ค่าลดหย่อน แล้วนำไปคูณอัตราภาษีแบบก้าวหน้าของประเทศไทย (5% - 35%)
                    </p>
                    <p>
                      <strong>สูตรเงินเพิ่ม</strong>: <code className="bg-slate-100 px-1 rounded font-mono text-slate-700">ภาษีค้าง × 1.5% × จำนวนเดือนล่าช้า</code> โดยเศษของเดือนให้ปัดเป็น 1 เดือน และเพดานสูงสุดห้ามนำส่งเงินเพิ่มเกินตัวเงินภาษีค้างหลัก
                    </p>
                    <p>
                      <strong>สูตรเบี้ยปรับ</strong>: <code className="bg-slate-100 px-1 rounded font-mono text-slate-700">ภาษีค้าง × อัตราเบี้ยปรับตามประเมิน × เปอร์เซ็นต์หลังลดหย่อน</code>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ป้ายเตือนหรือข้อเสนอแนะเพิ่มเติม */}
          {activeTab === 'pit' && taxOwedToUse > 0 && scenario !== FilingScenario.VOLUNTARY && (
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-900 block">คำเตือนทางเลือกสรรพากร</span>
                <p className="text-[11px] text-amber-800 font-light leading-relaxed">
                  หากตรวจพบเจอข้อมูลรายได้ผิดพลาดหรือตกหล่น แนะนำให้รีบทำการ <strong>"ยื่นเพิ่มเติมด้วยตนเอง" (Voluntary)</strong> ก่อนที่เจ้าหน้าที่สรรพากรจะมีจดหมายส่งมาแจ้งประเมิน เพื่อไม่ต้องเสียเบี้ยปรับ (0%) เสียเฉพาะเงินเพิ่ม 1.5% ต่อเดือนและค่าปรับอาญา (ถ้ามี)
                </p>
              </div>
            </div>
          )}

        </section>

        {/* ประวัติการคำนวณ (เต็มความกว้าง) */}
        <section className="lg:col-span-12">
          <HistoryPanel
            records={history}
            onLoad={handleLoadRecord}
            onDelete={handleDeleteRecord}
            onClear={handleClearHistory}
            onExportAll={() => exportHistoryToExcel(history)}
            onExportOne={(r) => exportRecordToExcel(r)}
          />
        </section>

      </main>

      {/* ส่วนท้ายกระดาษ (Footer) */}
      <footer className="bg-slate-900 text-slate-400 text-center py-5 border-t border-slate-800 text-xs shrink-0 mt-8">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-light">
            แอปพลิเคชันนี้ทำหน้าที่ช่วยประเมินและอำนวยความสะดวกในการจัดสรรคำนวณเบื้องต้นเท่านั้น 
            การประเมินทางกฎหมายและยอดชำระจริงจะขึ้นอยู่กับดุลยพินิจและระบบของกรมสรรพากรโดยตรง
          </p>
          <div className="flex justify-center items-center gap-4 text-[10px] text-slate-500 pt-1">
            <a href="https://www.rd.go.th" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 flex items-center gap-0.5">
              เว็บไซต์กรมสรรพากร <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span>•</span>
            <span>ปีลิขสิทธิ์ความคุ้มครอง © 2569</span>
          </div>
        </div>
      </footer>

      {/* Print Preview & Export Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <div className="text-left">
                    <h3 className="font-bold text-sm tracking-tight">รายงานประเมินภาษีและค่าปรับแบบเป็นทางการ</h3>
                    <p className="text-[10px] text-slate-300 font-light">ข้อมูลประเมินเบื้องต้น ณ วันที่ {formatThaiDate(paymentDate)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Notice Bar for iFrame limits */}
              <div className="bg-amber-50 border-b border-amber-100 p-4 text-amber-900 text-xs flex items-start gap-2.5 text-left">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">💡 เคล็ดลับการสั่งพิมพ์หรือบันทึก PDF:</span>
                  <p className="text-[11px] leading-relaxed font-light text-amber-800">
                    เนื่องจากแอปพลิเคชันกำลังทำงานอยู่ในโหมดจำลอง (iFrame Sandbox) ของ Google AI Studio 
                    หากปุ่มพิมพ์ด้านล่างไม่แสดงผลการพิมพ์หรือบันทึก PDF ของเบราว์เซอร์ 
                    <strong>แนะนำให้กดปุ่มคัดลอกสรุปข้อความ หรือกดปุ่ม "เปิดในแท็บใหม่"</strong> ที่หน้าต่าง AI Studio ด้านบนเพื่อเข้าใช้แอปในลิงก์จริง แล้วทำการสั่งพิมพ์/เซฟ PDF ได้ทันทีอย่างมีประสิทธิภาพสูงสุด!
                  </p>
                </div>
              </div>

              {/* Receipt Area (This is what will be printed if window.print() is called) */}
              <div id="printable-receipt" className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 bg-slate-50/50">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden text-left">
                  
                  {/* Decorative badge watermarked */}
                  <div className="absolute top-2 right-2 border-2 border-emerald-500/30 text-emerald-600/40 font-extrabold uppercase text-[10px] tracking-widest py-1 px-3 rounded-xl rotate-12">
                    UNOFFICIAL ASSESSMENT
                  </div>

                  {/* Receipt Header */}
                  <div className="text-center pb-4 border-b border-dashed border-slate-200">
                    <Building className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                    <h2 className="text-base font-bold text-slate-900">สรุปรายงานประเมินภาระภาษีล่าช้า ({activeTab === 'pit' ? 'ภ.ง.ด.90/91' : 'ภ.พ.30'})</h2>
                    <p className="text-[10px] text-slate-500 mt-1">ประเมินผลสำหรับ ปีภาษี พ.ศ. {yearThToUse}</p>
                    <div className="text-[9px] text-slate-400 mt-1 flex justify-center items-center gap-2">
                      <span>ประเภท: {scenarioLabelResult}</span>
                      <span>•</span>
                      <span>ช่องทาง: {filingMethodToUse === FilingMethod.ONLINE ? 'ออนไลน์' : 'ยื่นกระดาษ'}</span>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[9px]">กำหนดชำระปกติ:</span>
                      <span className="font-semibold text-slate-700">{formatThaiDate(deadlineToUse)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">วันที่คาดว่าจะชำระจริง:</span>
                      <span className="font-semibold text-slate-700">{formatThaiDate(paymentDateToUse)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">จำนวนเดือนที่ล่าช้า:</span>
                      <span className="font-semibold text-indigo-700">{resultToUse.monthsLate} เดือน</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">เบี้ยปรับที่ต้องเสีย (% ของเบี้ยปรับตามกฎหมาย):</span>
                      <span className="font-semibold text-rose-600">{resultToUse.penaltyDiscountPercent}%</span>
                    </div>
                  </div>

                  {/* Calculations Details Table */}
                  <div className="space-y-2.5 text-xs">
                    <span className="font-bold text-slate-900 text-[11px] block">รายละเอียดภาระภาษีทั้งหมด</span>
                    
                    {/* Item 1 */}
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">1. ภาษีที่ค้างชำระ (Tax Owed)</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ฿{formatBaht(resultToUse.taxOwed)}
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="text-slate-600">2. ค่าปรับอาญาล่าช้า (Criminal Fine)</span>
                        <span className="text-[9px] text-slate-400 block font-light">
                          {resultToUse.criminalFineApplies && resultToUse.criminalFine === 0
                            ? 'ยังไม่รวมในยอด (ผู้ใช้ยังไม่ได้กรอกจำนวนที่สรรพากรแจ้ง)'
                            : resultToUse.criminalFineMax !== null
                              ? `ตามที่สรรพากรแจ้ง ไม่เกิน ${formatBaht(resultToUse.criminalFineMax, 0)} บาท (ม.35)`
                              : 'ตามที่สรรพากรแจ้ง'}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-indigo-600">
                        ฿{formatBaht(resultToUse.criminalFine)}
                      </span>
                    </div>

                    {/* Item 3 */}
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="text-slate-600">3. เงินเพิ่ม (Surcharge) {activeTab === 'pit' ? 'ม. 27' : 'ม. 89/1'}</span>
                        <span className="text-[9px] text-slate-400 block font-light">อัตรา 1.5% ต่อเดือน (คำนวณ {resultToUse.monthsLate} เดือน)</span>
                      </div>
                      <span className="font-mono font-semibold text-amber-600">
                        ฿{formatBaht(resultToUse.surcharge)}
                      </span>
                    </div>

                    {/* Item 4 */}
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="text-slate-600">4. เบี้ยปรับ (Penalty) {activeTab === 'pit' ? 'ม. 22' : 'ม. 89'}</span>
                        <span className="text-[9px] text-slate-400 block font-light">
                          {isVoluntaryResult
                            ? `ยื่นเอง: เหลือ ${resultToUse.penaltyDiscountPercent}% ของเบี้ยปรับตามกฎหมาย`
                            : `เหลือ ${resultToUse.penaltyDiscountPercent}% ของเบี้ยปรับตามกฎหมาย`}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-rose-600">
                        ฿{formatBaht(resultToUse.penaltyReduced)}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 pb-1 border-t border-slate-300 font-extrabold text-sm text-slate-900">
                      <span>ยอดรวมที่ต้องชำระ (Total)</span>
                      <span className="font-mono text-emerald-600">
                        ฿{formatBaht(resultToUse.totalToPay)}
                      </span>
                    </div>

                    {/* Savings Notification */}
                    <div className="bg-emerald-50 text-emerald-800 text-[10px] p-2.5 rounded-xl border border-emerald-100 flex items-center gap-1.5 mt-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        ประหยัดเบี้ยปรับได้ <strong>฿{formatBaht(resultToUse.penaltyOriginal - resultToUse.penaltyReduced)}</strong> บาท จากการลดหย่อน/ยกเว้นตามกฎระเบียบ
                      </span>
                    </div>
                  </div>

                  {/* Stamp & Footer */}
                  <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-end">
                    <div className="text-[9px] text-slate-400 leading-relaxed font-light">
                      * คำนวณเบื้องต้นเพื่ออำนวยความสะดวกเท่านั้น<br />
                      * โปรดตรวจสอบยอดอย่างเป็นทางการกับระบบยื่นแบบสรรพากรอีกครั้ง
                    </div>
                    <div className="text-center">
                      <div className="w-20 h-1 bg-slate-200 mx-auto mb-1"></div>
                      <span className="text-[8px] text-slate-400 block">ผู้ตรวจสอบข้อมูล</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 bg-slate-100 border-t border-slate-200/80 flex flex-col md:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={exporting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                  {exporting ? 'กำลังประมวลผลรูปภาพ...' : 'ดาวน์โหลดรายงาน (รูปภาพ PNG)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ / เซฟ PDF (เบราว์เซอร์)
                </button>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'คัดลอกสำเร็จ!' : 'คัดลอกสรุปข้อความ'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer md:shrink-0"
                >
                  ปิด
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
