import React from 'react';
import { Plus, Trash2, RotateCcw, Info, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  INCOME_KINDS,
  INCOME_TAX_SOURCE,
  IncomeEstimateInput,
  IncomeEstimateResult,
  IncomeKind,
  IncomeLine,
  AllowanceInputs,
  defaultSub,
  kindInfo,
  newLineId,
} from '../utils/incomeTax';
import { calculateProgressiveTax } from '../utils/taxCalc';
import { formatBaht, formatInputNumber } from '../utils/format';
import ProgressiveTaxBar from './ProgressiveTaxBar';

interface Props {
  value: IncomeEstimateInput;
  result: IncomeEstimateResult;
  onChange: (v: IncomeEstimateInput) => void;
  onReset: () => void;
}

const inputCls =
  'w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-1.5 pl-6 pr-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold';

function MoneyField({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-600 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">฿</span>
        <input
          type="text"
          inputMode="decimal"
          value={value ? formatInputNumber(value) : ''}
          placeholder="0"
          onChange={(e) => {
            const clean = e.target.value.replace(/,/g, '');
            if (clean === '' || /^\d*\.?\d*$/.test(clean)) onChange(parseFloat(clean) || 0);
          }}
          className={inputCls}
        />
      </div>
      {hint && <p className="text-[10px] text-slate-400 font-light leading-snug">{hint}</p>}
    </div>
  );
}

function CountField({ label, hint, value, max, onChange }: { label: string; hint?: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-600 block">{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        value={value || ''}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0)))}
        className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
      />
      {hint && <p className="text-[10px] text-slate-400 font-light leading-snug">{hint}</p>}
    </div>
  );
}

export default function IncomeEstimator({ value, result, onChange, onReset }: Props) {
  const setLine = (id: string, patch: Partial<IncomeLine>) =>
    onChange({ ...value, lines: value.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = (kind: IncomeKind) =>
    onChange({
      ...value,
      lines: [...value.lines, { id: newLineId(), kind, amount: 0, sub: defaultSub(kind), actual: false, actualExpense: 0 }],
    });
  const removeLine = (id: string) => onChange({ ...value, lines: value.lines.filter((l) => l.id !== id) });
  const setAllow = (patch: Partial<AllowanceInputs>) => onChange({ ...value, allowances: { ...value.allowances, ...patch } });
  const a = value.allowances;

  return (
    <div className="space-y-4">
      {/* ขั้นที่ 1: เลือกอาชีพ / ประเภทเงินได้ */}
      <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-indigo-900 block">ขั้นที่ 1: รายได้ของคุณมาจากอะไร</span>
            <p className="text-indigo-800 font-light leading-relaxed">
              กดเลือกอาชีพหรือแหล่งรายได้ที่ตรงกับคุณ ระบบจะหักค่าใช้จ่ายให้ตามกฎของแต่ละประเภท (ทำได้หลายรายการ เช่น มีเงินเดือนและขายของออนไลน์ด้วย)
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INCOME_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => addLine(k.kind)}
              className="text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-800">{k.title}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-indigo-600 shrink-0">
                  <Plus className="w-3 h-3" />
                  {k.section}
                </span>
              </span>
              <span className="block text-[10px] text-slate-400 font-light leading-snug">เช่น {k.examples}</span>
            </button>
          ))}
        </div>
      </div>

      {/* รายการรายได้ */}
      {value.lines.length === 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
          ยังไม่มีรายการรายได้ กดเลือกอาชีพด้านบนอย่างน้อย 1 รายการ
        </p>
      )}
      <div className="space-y-3">
        {value.lines.map((l) => {
          const info = kindInfo(l.kind);
          const lr = result.lines.find((r) => r.id === l.id);
          return (
            <div key={l.id} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {info.title} <span className="font-mono text-indigo-600 font-semibold">{info.section}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-light">{info.note}</span>
                </div>
                <button
                  type="button"
                  title="ลบรายการนี้"
                  onClick={() => removeLine(l.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MoneyField label="เงินได้ทั้งปี (ก่อนหักค่าใช้จ่าย)" value={l.amount} onChange={(n) => setLine(l.id, { amount: n })} />

                {info.subOptions && !l.actual && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">{info.subLabel}</label>
                    <select
                      value={l.sub || defaultSub(l.kind)}
                      onChange={(e) => setLine(l.id, { sub: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {info.subOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {info.allowActual && (
                <div className="space-y-1.5">
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLine(l.id, { actual: false })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${!l.actual ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      หักเหมาตามอัตรา
                    </button>
                    <button
                      type="button"
                      onClick={() => setLine(l.id, { actual: true })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${l.actual ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      หักตามจริง
                    </button>
                  </div>
                  {l.actual && (
                    <MoneyField
                      label="ค่าใช้จ่ายจริงทั้งปี (ต้องมีหลักฐาน)"
                      value={l.actualExpense}
                      onChange={(n) => setLine(l.id, { actualExpense: n })}
                    />
                  )}
                </div>
              )}

              {lr && (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  หักค่าใช้จ่าย <strong className="font-mono text-slate-700">฿{formatBaht(lr.expense)}</strong> ({lr.basis}) เหลือเงินได้{' '}
                  <strong className="font-mono text-slate-700">฿{formatBaht(lr.net)}</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ขั้นที่ 2: ค่าลดหย่อน */}
      <details className="group rounded-xl border border-slate-200 bg-white p-3" open>
        <summary className="cursor-pointer text-xs font-bold text-slate-800 select-none">
          ขั้นที่ 2: ค่าลดหย่อน <span className="font-light text-slate-400">(ส่วนตัว 60,000 บาท ใส่ให้อัตโนมัติ)</span>
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <input type="checkbox" checked={a.spouse} onChange={(e) => setAllow({ spouse: e.target.checked })} />
            มีคู่สมรสที่ไม่มีเงินได้ (60,000 บาท)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CountField label="บุตร (คนแรก/เกิดก่อนปี 2561)" hint="คนละ 30,000" value={a.childrenFirst} max={10} onChange={(n) => setAllow({ childrenFirst: n })} />
            <CountField label="บุตรคนที่ 2+ (เกิดปี 2561 ขึ้นไป)" hint="คนละ 60,000" value={a.childrenSecondPlus} max={10} onChange={(n) => setAllow({ childrenSecondPlus: n })} />
            <CountField label="บิดามารดา (อายุ 60+)" hint="คนละ 30,000 สูงสุด 4 คน" value={a.parents} max={6} onChange={(n) => setAllow({ parents: n })} />
            <CountField label="ผู้พิการในอุปการะ" hint="คนละ 60,000" value={a.disabled} max={10} onChange={(n) => setAllow({ disabled: n })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MoneyField label="เงินสมทบประกันสังคม" hint="ไม่เกิน 9,000 บาท" value={a.socialSecurity} onChange={(n) => setAllow({ socialSecurity: n })} />
            <MoneyField label="เบี้ยประกันชีวิต" hint="รวมกับประกันสุขภาพตนเองไม่เกิน 100,000" value={a.lifeInsurance} onChange={(n) => setAllow({ lifeInsurance: n })} />
            <MoneyField label="เบี้ยประกันสุขภาพตนเอง" hint="ไม่เกิน 25,000 บาท" value={a.ownHealthInsurance} onChange={(n) => setAllow({ ownHealthInsurance: n })} />
            <MoneyField label="เบี้ยประกันสุขภาพบิดามารดา" hint="ไม่เกิน 15,000 บาท" value={a.parentsHealthInsurance} onChange={(n) => setAllow({ parentsHealthInsurance: n })} />
            <MoneyField label="กองทุนเกษียณ (สำรองเลี้ยงชีพ/RMF/ประกันบำนาญ)" hint="รวมไม่เกิน 500,000 และไม่เกิน 30% ของเงินได้" value={a.retirement} onChange={(n) => setAllow({ retirement: n })} />
            <MoneyField label="ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย" hint="ไม่เกิน 100,000 บาท" value={a.homeLoanInterest} onChange={(n) => setAllow({ homeLoanInterest: n })} />
            <MoneyField label="ลดหย่อนอื่นๆ (เงินบริจาค SSF ฯลฯ ที่คำนวณเองแล้ว)" hint="ระบบไม่ตรวจเพดานช่องนี้" value={a.other} onChange={(n) => setAllow({ other: n })} />
          </div>
          <p className="text-[10px] text-slate-400 font-light">
            ตัวเลขลดหย่อนอ้างอิงปีภาษี 2568 ควรตรวจกับกรมสรรพากรก่อนใช้จริง
          </p>
        </div>
      </details>

      {/* ขั้นที่ 3: ภาษีที่จ่ายแล้ว */}
      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
        <span className="text-xs font-bold text-slate-800 block">ขั้นที่ 3: ภาษีที่จ่ายไปแล้วในปีนั้น</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MoneyField
            label="ภาษีที่ถูกหัก ณ ที่จ่าย"
            hint="ดูจากหนังสือรับรองการหักภาษี (50 ทวิ) เช่น นายจ้างหักเงินเดือน ลูกค้าหัก 3%"
            value={value.withheld}
            onChange={(n) => onChange({ ...value, withheld: n })}
          />
          <MoneyField
            label="ภาษีที่ชำระล่วงหน้า (ภ.ง.ด.94 ครึ่งปี)"
            hint="กรณีมีเงินได้ 40(5)-(8) และยื่นครึ่งปีแล้ว"
            value={value.prepaid}
            onChange={(n) => onChange({ ...value, prepaid: n })}
          />
        </div>
      </div>

      {/* ผลการประเมิน */}
      <div className="p-3 rounded-xl border border-indigo-100 bg-white space-y-2 text-xs">
        <span className="text-xs font-bold text-slate-800 block">ผลการประเมินภาษี</span>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono">
          <dt className="font-sans text-slate-500">เงินได้รวม</dt>
          <dd className="text-right">฿{formatBaht(result.assessableIncome)}</dd>
          <dt className="font-sans text-slate-500">หักค่าใช้จ่าย</dt>
          <dd className="text-right">-฿{formatBaht(result.totalExpenses)}</dd>
          <dt className="font-sans text-slate-500">หักค่าลดหย่อน</dt>
          <dd className="text-right">-฿{formatBaht(result.totalAllowances)}</dd>
          <dt className="font-sans font-semibold text-slate-700">เงินได้สุทธิ</dt>
          <dd className="text-right font-semibold">฿{formatBaht(result.netIncome)}</dd>
          <dt className="font-sans text-slate-500">ภาษีตามอัตราก้าวหน้า (วิธีที่ 1)</dt>
          <dd className="text-right">฿{formatBaht(result.progressiveTax)}</dd>
          {result.minTaxBase >= 120000 && (
            <>
              <dt className="font-sans text-slate-500">ภาษีขั้นต่ำ 0.5% ของเงินได้ 40(2)-(8) (วิธีที่ 2)</dt>
              <dd className="text-right">฿{formatBaht(result.minTax)}</dd>
            </>
          )}
          <dt className="font-sans font-semibold text-slate-700">
            ภาษีที่ต้องเสีย{result.minTaxApplies ? ' (ใช้วิธีที่ 2 เพราะสูงกว่า)' : ''}
          </dt>
          <dd className="text-right font-semibold">฿{formatBaht(result.taxTotal)}</dd>
          <dt className="font-sans text-slate-500">หัก ภาษีที่จ่ายไปแล้ว</dt>
          <dd className="text-right">-฿{formatBaht(result.credits)}</dd>
          <dt className="font-sans font-bold text-indigo-800">{result.refund > 0 ? 'ภาษีที่ชำระไว้เกิน (ขอคืนได้)' : 'ภาษีที่ขาด ต้องชำระเพิ่ม'}</dt>
          <dd className="text-right font-extrabold text-indigo-700">฿{formatBaht(result.refund > 0 ? result.refund : result.additionalTax)}</dd>
        </dl>
        {result.warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-[10px] text-amber-700 leading-snug">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            {w}
          </p>
        ))}
        <p className="text-[10px] text-slate-400 font-light leading-snug">
          อัตราหักค่าใช้จ่ายอ้างอิง{' '}
          <a href={INCOME_TAX_SOURCE.expensesUrl} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
            กรมสรรพากร (การหักค่าใช้จ่าย) <ExternalLink className="w-2.5 h-2.5" />
          </a>{' '}
          และ พ.ร.ฎ. ฉบับที่ 629 ผลนี้เป็นการประมาณการ ไม่ใช่การประเมินภาษีของเจ้าพนักงาน
        </p>
      </div>

      {result.netIncome > 0 && (
        <ProgressiveTaxBar
          netIncome={result.netIncome}
          bracketBreakdown={calculateProgressiveTax(result.netIncome).bracketBreakdown}
          totalTax={result.progressiveTax}
        />
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2.5 rounded-lg border border-slate-200/80 bg-white"
        >
          <RotateCcw className="w-3 h-3" />
          รีเซ็ตค่าประเมิน
        </button>
      </div>
    </div>
  );
}
