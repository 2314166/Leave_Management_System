export const DAY_MS = 86_400_000;

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Normalises a date or 'YYYY-MM-DD' string to UTC midnight. */
export function parseDay(value: string | Date): Date {
  const d = new Date(value);
  if (isNaN(d.getTime())) return d;
  return new Date(toDateKey(d));
}

/** Every calendar day from start to end, inclusive. */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    days.push(new Date(t));
  }
  return days;
}

export function isWeekend(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

/** Days that count as leave: no weekends, no public holidays. */
export function workingDays(start: Date, end: Date, holidayKeys: string[]): Date[] {
  const holidays = new Set(holidayKeys);
  return eachDay(start, end).filter((d) => !isWeekend(d) && !holidays.has(toDateKey(d)));
}

/** Whole days between today and the start date. */
export function noticeDays(today: Date, start: Date): number {
  return Math.round((start.getTime() - today.getTime()) / DAY_MS);
}

/** Remaining balance. Pending requests count against it. */
export function remainingBalance(total: number, used: number, pending: number): number {
  return total - used - pending;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Returns the first day (YYYY-MM-DD) on which adding one more person off would
 * exceed `max`, or null if coverage is fine on every day.
 */
export function firstOverCapacityDay(
  days: Date[],
  others: { startDate: Date; endDate: Date }[],
  max: number,
): string | null {
  for (const d of days) {
    const off = others.filter((o) => o.startDate <= d && o.endDate >= d).length;
    if (off + 1 > max) return toDateKey(d);
  }
  return null;
}