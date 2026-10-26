import { calculateProgressiveTax, round2 } from './taxCalc';

// ตัวประเมินภาษีเงินได้บุคคลธรรมดาตามประเภทเงินได้ 40(1)-(8)
// อัตราหักค่าใช้จ่าย: หน้า "การหักค่าใช้จ่าย" ของกรมสรรพากร (rd.go.th/556, ปรับปรุง 21-11-2020) และ พ.ร.ฎ. ฉบับที่ 629
// ค่าลดหย่อน: ตามข้อมูลปีภาษี 2568 ควรตรวจกับกรมสรรพากรก่อนใช้จริง
export const INCOME_TAX_SOURCE = {
  expenses: 'กรมสรรพากร: การหักค่าใช้จ่าย (rd.go.th/556) และ พ.ร.ฎ. ฉบับที่ 629 พ.ศ. 2560',
  expensesUrl: 'https://rd.go.th/556.html',
  allowances: 'ค่าลดหย่อนปีภาษี 2568',
  minTax: 'มาตรา 48 ทวิ (ภาษีขั้นต่ำ 0.5% ของเงินได้ 40(2)-(8) เมื่อรวมตั้งแต่ 120,000 บาท)',
} as const;

export type IncomeKind =
  | 'salary' // 40(1)
  | 'freelance' // 40(2)
  | 'rights' // 40(3)
  | 'interest' // 40(4)
  | 'rent' // 40(5)
  | 'profession' // 40(6)
  | 'contract' // 40(7)
  | 'business'; // 40(8)

// ทางเลือกย่อยของแต่ละประเภท (อัตราหักเหมา)
export interface SubOption {
  key: string;
  label: string;
  rate: number; // 0-1 ใช้เมื่อหักเหมา
}

export interface IncomeKindInfo {
  kind: IncomeKind;
  section: string; // เช่น "40(1)"
  title: string; // ชื่อที่ผู้ใช้เข้าใจ
  examples: string; // ตัวอย่างอาชีพ
  allowActual: boolean; // เลือกหักตามจริงได้ไหม
  flatRate: number; // อัตราหักเหมา (ถ้าไม่มี subOptions)
  flatCap?: number; // เพดานหักเหมา
  subLabel?: string; // ชื่อช่องเลือกย่อย
  subOptions?: SubOption[];
  note: string;
}

export const INCOME_KINDS: IncomeKindInfo[] = [
  {
    kind: 'salary', section: '40(1)', title: 'เงินเดือน ค่าจ้างประจำ โบนัส',
    examples: 'พนักงานบริษัท ข้าราชการ ลูกจ้างประจำ',
    allowActual: false, flatRate: 0.5, flatCap: 100000,
    note: 'หักเหมา 50% ไม่เกิน 100,000 บาท (รวมกับ 40(2) แล้วไม่เกิน 100,000 บาท)',
  },
  {
    kind: 'freelance', section: '40(2)', title: 'รับจ้างทั่วไป ค่านายหน้า ค่าเบี้ยประชุม',
    examples: 'ฟรีแลนซ์ รับจ้างเป็นครั้งคราว นายหน้า วิทยากร',
    allowActual: false, flatRate: 0.5, flatCap: 100000,
    note: 'หักเหมา 50% รวมกับ 40(1) แล้วไม่เกิน 100,000 บาท',
  },
  {
    kind: 'rights', section: '40(3)', title: 'ค่าลิขสิทธิ์ ค่าสิทธิ กู๊ดวิลล์',
    examples: 'นักเขียน นักแต่งเพลง เจ้าของลิขสิทธิ์ ค่าสิทธิแฟรนไชส์',
    allowActual: true, flatRate: 0.5, flatCap: 100000,
    note: 'หักเหมา 50% ไม่เกิน 100,000 บาท หรือหักตามจริง',
  },
  {
    kind: 'interest', section: '40(4)', title: 'ดอกเบี้ย เงินปันผล ส่วนแบ่งกำไร',
    examples: 'ดอกเบี้ยเงินฝาก/พันธบัตร เงินปันผลจากบริษัท กองทุน',
    allowActual: false, flatRate: 0,
    note: 'หักค่าใช้จ่ายไม่ได้ (เงินปันผลอาจมีเครดิตภาษีหรือเลือกเสียภาษี 10% ซึ่งระบบนี้ยังไม่คำนวณ)',
  },
  {
    kind: 'rent', section: '40(5)', title: 'ค่าเช่าทรัพย์สิน',
    examples: 'ให้เช่าบ้าน คอนโด ที่ดิน รถ ทรัพย์สินอื่น',
    allowActual: true, flatRate: 0.3, subLabel: 'ชนิดทรัพย์ที่ให้เช่า',
    subOptions: [
      { key: 'building', label: 'บ้าน อาคาร สิ่งปลูกสร้าง แพ (30%)', rate: 0.3 },
      { key: 'farmland', label: 'ที่ดินเพื่อเกษตรกรรม (20%)', rate: 0.2 },
      { key: 'land', label: 'ที่ดินที่ไม่ได้ใช้เกษตรกรรม (15%)', rate: 0.15 },
      { key: 'vehicle', label: 'ยานพาหนะ (30%)', rate: 0.3 },
      { key: 'other', label: 'ทรัพย์สินอื่น (10%)', rate: 0.1 },
    ],
    note: 'หักเหมาตามชนิดทรัพย์สิน หรือหักตามจริง',
  },
  {
    kind: 'profession', section: '40(6)', title: 'วิชาชีพอิสระ',
    examples: 'แพทย์ ทนายความ วิศวกร สถาปนิก นักบัญชี ศิลปิน',
    allowActual: true, flatRate: 0.3, subLabel: 'วิชาชีพ',
    subOptions: [
      { key: 'medical', label: 'การประกอบโรคศิลปะ เช่น แพทย์ (60%)', rate: 0.6 },
      { key: 'other', label: 'กฎหมาย วิศวกรรม สถาปัตย์ บัญชี ประณีตศิลป์ (30%)', rate: 0.3 },
    ],
    note: 'หักเหมาตามวิชาชีพ หรือหักตามจริง',
  },
  {
    kind: 'contract', section: '40(7)', title: 'รับเหมา (ผู้รับเหมาจัดหาวัสดุสำคัญเอง)',
    examples: 'ผู้รับเหมาก่อสร้าง ผู้รับเหมาที่ลงทุนซื้อวัสดุเอง',
    allowActual: true, flatRate: 0.6,
    note: 'หักเหมา 60% หรือหักตามจริง',
  },
  {
    kind: 'business', section: '40(8)', title: 'ธุรกิจ ค้าขาย พาณิชย์ เกษตร อุตสาหกรรม',
    examples: 'ขายของออนไลน์ ร้านค้า ร้านอาหาร ขนส่ง โรงงาน เกษตรกร',
    allowActual: true, flatRate: 0.6, subLabel: 'อัตราหักเหมา',
    subOptions: [
      { key: 'r60', label: 'หักเหมา 60% (กิจการส่วนใหญ่)', rate: 0.6 },
      { key: 'r40', label: 'หักเหมา 40% (บางประเภทกิจการ)', rate: 0.4 },
    ],
    note: 'พ.ร.ฎ. 629: หักเหมาได้ไม่เกิน 60% และบางประเภทกิจการได้ต่ำกว่านั้น ตรวจตารางของกรมสรรพากรให้ตรงกับธุรกิจของคุณ หรือเลือกหักตามจริง',
  },
];

export function kindInfo(kind: IncomeKind): IncomeKindInfo {
  return INCOME_KINDS.find((k) => k.kind === kind)!;
}

export interface IncomeLine {
  id: string;
  kind: IncomeKind;
  amount: number; // เงินได้ทั้งปี
  sub: string; // key ของ subOptions (ถ้ามี)
  actual: boolean; // true = หักตามจริง
  actualExpense: number;
}

export interface AllowanceInputs {
  spouse: boolean; // คู่สมรสไม่มีเงินได้
  childrenFirst: number; // บุตรคนแรก / เกิดก่อนปี 2561 คนละ 30,000
  childrenSecondPlus: number; // บุตรคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561 คนละ 60,000
  parents: number; // บิดามารดา อายุ 60+ รายได้ไม่เกิน 30,000 คนละ 30,000
  disabled: number; // ผู้พิการ/ทุพพลภาพ ในอุปการะ คนละ 60,000
  socialSecurity: number; // ไม่เกิน 9,000
  lifeInsurance: number; // ไม่เกิน 100,000
  ownHealthInsurance: number; // ไม่เกิน 25,000 (รวมกับประกันชีวิตไม่เกิน 100,000)
  parentsHealthInsurance: number; // ไม่เกิน 15,000
  retirement: number; // กองทุนสำรองเลี้ยงชีพ/RMF/ประกันบำนาญ รวมไม่เกิน 500,000 และ 30% ของเงินได้
  homeLoanInterest: number; // ไม่เกิน 100,000
  other: number; // อื่นๆ (ไม่มีเพดานในระบบนี้ เช่น เงินบริจาค SSF ตามที่คำนวณมาแล้ว)
}

export interface IncomeEstimateInput {
  lines: IncomeLine[];
  allowances: AllowanceInputs;
  withheld: number; // ภาษีที่ถูกหัก ณ ที่จ่าย (50 ทวิ)
  prepaid: number; // ภาษีที่ชำระล่วงหน้า เช่น ภ.ง.ด.94
}

export const PERSONAL_ALLOWANCE = 60000;
export const SPOUSE_ALLOWANCE = 60000;
export const CHILD_ALLOWANCE = 30000;
export const CHILD_SECOND_PLUS_ALLOWANCE = 60000;
export const PARENT_ALLOWANCE = 30000;
export const DISABLED_ALLOWANCE = 60000;
export const MIN_TAX_THRESHOLD = 120000;
export const MIN_TAX_RATE = 0.005;
export const COMBINED_EXPENSE_CAP = 100000; // 40(1)+(2)

export interface LineResult {
  id: string;
  kind: IncomeKind;
  section: string;
  title: string;
  amount: number;
  expense: number;
  basis: string; // คำอธิบายวิธีหัก
  net: number; // เงินได้หลังหักค่าใช้จ่าย
}

export interface AllowanceItem {
  key: string;
  label: string;
  claimed: number; // ที่กรอก/นับได้ก่อนใช้เพดาน
  allowed: number; // ที่ใช้ได้จริง
  capNote: string; // เพดาน
}

export interface IncomeEstimateResult {
  lines: LineResult[];
  assessableIncome: number;
  totalExpenses: number;
  allowanceItems: AllowanceItem[];
  totalAllowances: number;
  netIncome: number;
  progressiveTax: number; // วิธีที่ 1
  minTaxBase: number; // เงินได้ 40(2)-(8)
  minTax: number; // วิธีที่ 2 (0 ถ้าไม่เข้าเงื่อนไข)
  minTaxApplies: boolean; // วิธีที่ 2 สูงกว่าและถูกใช้
  taxTotal: number;
  credits: number;
  additionalTax: number; // ภาษีที่ต้องชำระเพิ่ม
  refund: number; // ภาษีที่ชำระไว้เกิน
  warnings: string[];
}

export function newLineId(): string {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultSub(kind: IncomeKind): string {
  const info = kindInfo(kind);
  return info.subOptions ? info.subOptions[0].key : '';
}

export function emptyAllowances(): AllowanceInputs {
  return {
    spouse: false, childrenFirst: 0, childrenSecondPlus: 0, parents: 0, disabled: 0,
    socialSecurity: 0, lifeInsurance: 0, ownHealthInsurance: 0, parentsHealthInsurance: 0,
    retirement: 0, homeLoanInterest: 0, other: 0,
  };
}

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function estimateIncomeTax(input: IncomeEstimateInput): IncomeEstimateResult {
  const warnings: string[] = [];
  const lines = input.lines;

  // ---- ค่าใช้จ่าย: 40(1)+(2) ใช้เพดานรวม 100,000 ส่วนประเภทอื่นคิดแยกรายรายการ
  const pooledFlat = lines
    .filter((l) => l.kind === 'salary' || l.kind === 'freelance')
    .reduce((s, l) => s + pos(l.amount) * 0.5, 0);
  const pooledTotal = Math.min(pooledFlat, COMBINED_EXPENSE_CAP);
  const pooledRatio = pooledFlat > 0 ? pooledTotal / pooledFlat : 0;

  const results: LineResult[] = lines.map((l) => {
    const info = kindInfo(l.kind);
    const amount = pos(l.amount);
    let expense = 0;
    let basis = '';
    if (l.kind === 'salary' || l.kind === 'freelance') {
      expense = amount * 0.5 * pooledRatio;
      basis = pooledFlat > COMBINED_EXPENSE_CAP
        ? `เหมา 50% แต่ 40(1)+(2) รวมกันหักได้ไม่เกิน ${COMBINED_EXPENSE_CAP.toLocaleString('en-US')} บาท`
        : 'เหมา 50%';
    } else if (l.kind === 'interest') {
      expense = 0;
      basis = 'หักค่าใช้จ่ายไม่ได้';
    } else if (l.actual && info.allowActual) {
      expense = Math.min(pos(l.actualExpense), amount);
      basis = 'ตามจริง';
    } else {
      const sub = info.subOptions?.find((o) => o.key === l.sub) ?? info.subOptions?.[0];
      const rate = sub ? sub.rate : info.flatRate;
      expense = amount * rate;
      if (info.flatCap !== undefined) expense = Math.min(expense, info.flatCap);
      basis = `เหมา ${Math.round(rate * 100)}%${info.flatCap !== undefined ? ` (ไม่เกิน ${info.flatCap.toLocaleString('en-US')} บาท)` : ''}`;
    }
    expense = round2(expense);
    return {
      id: l.id, kind: l.kind, section: info.section, title: info.title,
      amount, expense, basis, net: round2(amount - expense),
    };
  });

  const assessableIncome = round2(results.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round2(results.reduce((s, r) => s + r.expense, 0));

  // ---- ค่าลดหย่อน
  const a = input.allowances;
  const items: AllowanceItem[] = [];
  const add = (key: string, label: string, claimed: number, allowed: number, capNote: string) =>
    items.push({ key, label, claimed: round2(claimed), allowed: round2(Math.min(claimed, allowed)), capNote });

  add('personal', 'ส่วนตัว', PERSONAL_ALLOWANCE, PERSONAL_ALLOWANCE, '60,000 บาท');
  if (a.spouse) add('spouse', 'คู่สมรสไม่มีเงินได้', SPOUSE_ALLOWANCE, SPOUSE_ALLOWANCE, '60,000 บาท');
  if (a.childrenFirst > 0) add('child1', `บุตร (คนแรก/เกิดก่อนปี 2561) ${a.childrenFirst} คน`, a.childrenFirst * CHILD_ALLOWANCE, a.childrenFirst * CHILD_ALLOWANCE, 'คนละ 30,000 บาท');
  if (a.childrenSecondPlus > 0) add('child2', `บุตรคนที่ 2 ขึ้นไป (เกิดปี 2561+) ${a.childrenSecondPlus} คน`, a.childrenSecondPlus * CHILD_SECOND_PLUS_ALLOWANCE, a.childrenSecondPlus * CHILD_SECOND_PLUS_ALLOWANCE, 'คนละ 60,000 บาท');
  if (a.parents > 0) {
    const n = Math.min(a.parents, 4);
    if (a.parents > 4) warnings.push('ลดหย่อนบิดามารดา นับได้ไม่เกิน 4 คน (ของตนเองและคู่สมรส)');
    add('parents', `บิดามารดา ${n} คน`, n * PARENT_ALLOWANCE, n * PARENT_ALLOWANCE, 'คนละ 30,000 บาท');
  }
  if (a.disabled > 0) add('disabled', `ผู้พิการ/ทุพพลภาพในอุปการะ ${a.disabled} คน`, a.disabled * DISABLED_ALLOWANCE, a.disabled * DISABLED_ALLOWANCE, 'คนละ 60,000 บาท');
  if (pos(a.socialSecurity) > 0) add('sso', 'เงินสมทบประกันสังคม', pos(a.socialSecurity), 9000, 'ไม่เกิน 9,000 บาท');
  // ประกันชีวิต + ประกันสุขภาพตนเอง: สุขภาพไม่เกิน 25,000 และรวมกันไม่เกิน 100,000
  const health = Math.min(pos(a.ownHealthInsurance), 25000);
  const lifeAndHealth = Math.min(pos(a.lifeInsurance) + health, 100000);
  if (pos(a.lifeInsurance) + health > 0) {
    add('life', 'เบี้ยประกันชีวิต + ประกันสุขภาพตนเอง', pos(a.lifeInsurance) + pos(a.ownHealthInsurance), lifeAndHealth, 'ชีวิตรวมสุขภาพไม่เกิน 100,000 (สุขภาพไม่เกิน 25,000)');
  }
  if (pos(a.parentsHealthInsurance) > 0) add('parentHealth', 'ประกันสุขภาพบิดามารดา', pos(a.parentsHealthInsurance), 15000, 'ไม่เกิน 15,000 บาท');
  if (pos(a.retirement) > 0) {
    const cap = Math.min(500000, assessableIncome * 0.3);
    add('retire', 'กองทุนเกษียณ (สำรองเลี้ยงชีพ/RMF/ประกันบำนาญ)', pos(a.retirement), cap, 'รวมไม่เกิน 500,000 และไม่เกิน 30% ของเงินได้');
  }
  if (pos(a.homeLoanInterest) > 0) add('home', 'ดอกเบี้ยเงินกู้ซื้อ/สร้างที่อยู่อาศัย', pos(a.homeLoanInterest), 100000, 'ไม่เกิน 100,000 บาท');
  if (pos(a.other) > 0) add('other', 'ค่าลดหย่อนอื่นๆ (ผู้ใช้คำนวณเอง)', pos(a.other), pos(a.other), 'ระบบไม่ตรวจเพดาน');

  const totalAllowances = round2(items.reduce((s, i) => s + i.allowed, 0));
  const netIncome = Math.max(0, round2(assessableIncome - totalExpenses - totalAllowances));

  // ---- ภาษี: วิธีที่ 1 (อัตราก้าวหน้า) เทียบกับ วิธีที่ 2 (ขั้นต่ำ 0.5%)
  const progressiveTax = calculateProgressiveTax(netIncome).totalTax;
  const minTaxBase = round2(results.filter((r) => r.kind !== 'salary').reduce((s, r) => s + r.amount, 0));
  const minTaxEligible = minTaxBase >= MIN_TAX_THRESHOLD;
  const minTax = minTaxEligible ? round2(minTaxBase * MIN_TAX_RATE) : 0;
  const minTaxApplies = minTaxEligible && minTax > progressiveTax;
  const taxTotal = minTaxApplies ? minTax : progressiveTax;

  const credits = round2(pos(input.withheld) + pos(input.prepaid));
  const diff = round2(taxTotal - credits);

  if (results.some((r) => r.kind === 'interest' && r.amount > 0)) {
    warnings.push('เงินปันผลอาจเลือกเสียภาษี 10% หรือใช้เครดิตภาษีได้ ระบบนี้ยังไม่คำนวณส่วนนี้ ผลภาษีจึงอาจสูงกว่าจริง');
  }
  if (results.some((r) => r.kind === 'business' && !input.lines.find((l) => l.id === r.id)?.actual)) {
    warnings.push('40(8): บางประเภทกิจการหักเหมาได้ต่ำกว่า 60% โปรดตรวจตารางของกรมสรรพากรให้ตรงกับธุรกิจของคุณ');
  }

  return {
    lines: results,
    assessableIncome,
    totalExpenses,
    allowanceItems: items,
    totalAllowances,
    netIncome,
    progressiveTax,
    minTaxBase,
    minTax,
    minTaxApplies,
    taxTotal,
    credits,
    additionalTax: Math.max(0, diff),
    refund: Math.max(0, -diff),
    warnings,
  };
}

// ค่าเริ่มต้นของตัวประเมิน: พนักงานเงินเดือน 480,000 ประกันสังคม 9,000 หัก ณ ที่จ่าย 8,500
export function defaultEstimateInput(): IncomeEstimateInput {
  return {
    lines: [{ id: newLineId(), kind: 'salary', amount: 480000, sub: '', actual: false, actualExpense: 0 }],
    allowances: { ...emptyAllowances(), socialSecurity: 9000 },
    withheld: 8500,
    prepaid: 0,
  };
}
