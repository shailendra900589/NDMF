/** Indian-style amount in words (rupees, whole numbers). */
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function threeDigits(n) {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h && r) return `${ONES[h]} Hundred ${twoDigits(r)}`;
  if (h) return `${ONES[h]} Hundred`;
  return twoDigits(r);
}

export function amountInWords(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Zero Only';
  if (n < 0) return `Minus ${amountInWords(-n)}`;

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return `${parts.join(' ')} Only`;
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

export function formatAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonthKey(month) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function emptyAmounts() {
  return {
    earnings: { basic: '', hra: '', conveyance: '', medical: '', special: '' },
    deductions: { epf: '', healthInsurance: '', professionalTax: '', tds: '' },
  };
}

/** Inclusive list of YYYY-MM from start through end. */
export function monthsInRange(startMonth, endMonth) {
  const start = String(startMonth || '');
  const end = String(endMonth || '');
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return [];
  if (start > end) return monthsInRange(end, start);
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 36) {
    out.push(cur);
    cur = nextMonthKey(cur);
    guard += 1;
  }
  return out;
}

/** N consecutive months starting at startMonth (N >= 1). */
export function monthsForCount(startMonth, count) {
  const n = Math.max(1, Math.min(36, Number(count) || 1));
  const out = [startMonth];
  let cur = startMonth;
  for (let i = 1; i < n; i += 1) {
    cur = nextMonthKey(cur);
    out.push(cur);
  }
  return out;
}

export function endMonthForCount(startMonth, count) {
  const list = monthsForCount(startMonth, count);
  return list[list.length - 1] || startMonth;
}
