/**
 * Amount in words for printed papers (components.md section 16): Indian system for INR
 * ("Rupees Nineteen Lakh Sixty-Five Thousand Six Hundred only"), international for others.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? below100(rest) : ''].filter(Boolean).join(' ');
}

/** Crore / Lakh / Thousand grouping. */
function indianWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** Thousand / Million / Billion grouping. */
function internationalWords(n: number): string {
  if (n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const parts: string[] = [];
  let i = 0;
  while (n > 0 && i < scales.length) {
    const chunk = n % 1000;
    if (chunk) parts.unshift([below1000(chunk), scales[i]].filter(Boolean).join(' '));
    n = Math.floor(n / 1000);
    i += 1;
  }
  return parts.join(' ');
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  INR: ['Rupees', 'Paise'],
  USD: ['US Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds', 'Pence'],
  AED: ['Dirhams', 'Fils'],
};

export function amountInWords(amount: number | string | null | undefined, currency = 'INR'): string {
  const value = Math.abs(Number(amount ?? 0) || 0);
  const whole = Math.floor(value);
  const minor = Math.round((value - whole) * 100);
  const cur = (currency || 'INR').toUpperCase();
  const [majorWord, minorWord] = CURRENCY_WORDS[cur] ?? [cur, 'Cents'];
  const words = cur === 'INR' ? indianWords(whole) : internationalWords(whole);
  const minorPart = minor > 0 ? ` and ${below100(minor)} ${minorWord}` : '';
  return `${majorWord} ${words}${minorPart} only`;
}
