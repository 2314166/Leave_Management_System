import {
  eachDay, firstOverCapacityDay, noticeDays, parseDay, rangesOverlap, remainingBalance, workingDays,
} from './leave-rules';

const d = (s: string) => parseDay(s);

describe('leave rules', () => {
  it('eachDay is inclusive of start and end', () => {
    expect(eachDay(d('2026-11-09'), d('2026-11-11'))).toHaveLength(3);
  });

  it('weekends do not count as leave days', () => {
    // Fri 2026-11-13 to Mon 2026-11-16 -> Fri + Mon
    expect(workingDays(d('2026-11-13'), d('2026-11-16'), [])).toHaveLength(2);
  });

  it('public holidays do not count as leave days', () => {
    // Tue to Thu, Wednesday is a holiday
    expect(workingDays(d('2026-11-10'), d('2026-11-12'), ['2026-11-11'])).toHaveLength(2);
  });

  it('a range of only weekend days has zero working days', () => {
    expect(workingDays(d('2026-11-14'), d('2026-11-15'), [])).toHaveLength(0);
  });

  it('pending requests reduce the remaining balance', () => {
    expect(remainingBalance(15, 3, 4)).toBe(8);
  });

  it('detects overlapping ranges', () => {
    expect(rangesOverlap(d('2026-11-10'), d('2026-11-12'), d('2026-11-12'), d('2026-11-14'))).toBe(true);
  });

  it('adjacent ranges do not overlap', () => {
    expect(rangesOverlap(d('2026-11-10'), d('2026-11-11'), d('2026-11-12'), d('2026-11-14'))).toBe(false);
  });

  it('flags the first day that exceeds team capacity', () => {
    const days = eachDay(d('2026-11-10'), d('2026-11-11'));
    const others = [{ startDate: d('2026-11-11'), endDate: d('2026-11-11') }];
    expect(firstOverCapacityDay(days, others, 1)).toBe('2026-11-11');
  });

  it('allows the request when team capacity is not exceeded', () => {
    const days = eachDay(d('2026-11-10'), d('2026-11-11'));
    const others = [{ startDate: d('2026-11-11'), endDate: d('2026-11-11') }];
    expect(firstOverCapacityDay(days, others, 2)).toBeNull();
  });

  it('calculates notice days', () => {
    expect(noticeDays(d('2026-11-08'), d('2026-11-10'))).toBe(2);
  });
});