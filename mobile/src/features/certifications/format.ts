export { formatDisplayDate as formatDate, formatClock as formatTimer } from '@/lib/format';
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Price not published';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  if (amount === 0) return 'No access fee';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: amount % 1 === 0 ? 0 : 2 })}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return 'Duration not published';
  return `${minutes} min`;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
