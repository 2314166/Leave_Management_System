import { LeavesController } from './app.controllers';
import { DAY_MS, parseDay, toDateKey } from './leave-rules';

// ---------- tiny in-memory fake of PrismaService ----------
function match(row: any, where: any, db: any): boolean {
  return Object.entries(where || {}).every(([k, v]: [string, any]) => {
    if (k === 'user') {
      const u = db.users.find((x: any) => x.id === row.userId);
      return !!u && match(u, v, db);
    }
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if (v.in && !v.in.includes(row[k])) return false;
      if (v.lte && !(row[k] <= v.lte)) return false;
      if (v.gte && !(row[k] >= v.gte)) return false;
      if ('not' in v && row[k] === v.not) return false;
      return true;
    }
    return row[k] === v;
  });
}

function applyData(row: any, data: any) {
  for (const [k, v] of Object.entries<any>(data)) {
    if (v && typeof v === 'object' && 'increment' in v) row[k] += v.increment;
    else if (v && typeof v === 'object' && 'decrement' in v) row[k] -= v.decrement;
    else row[k] = v;
  }
}

function makeDb() {
  const db: any = {
    users: [
      { id: 1, role: 'MANAGER', managerId: null },
      { id: 2, role: 'EMPLOYEE', managerId: 1 },
      { id: 3, role: 'EMPLOYEE', managerId: 1 },
      { id: 4, role: 'EMPLOYEE', managerId: 1 },
    ],
    types: [
      { name: 'ANNUAL', yearlyAllowance: 5, isPaid: true },
      { name: 'UNPAID', yearlyAllowance: 0, isPaid: false },
    ],
    leaves: [] as any[],
    balances: [] as any[],
    holidays: [] as any[],
    settings: { id: 1, minimumNoticeDays: 0, maxTeamMembersOffPerDay: 2 },
    nextId: 1,
  };
  const find = (id: number) => db.leaves.find((l: any) => l.id === id);
  const bal = (w: any) => db.balances.find((b: any) => b.userId === w.userId && b.type === w.type);

  db.prisma = {
    user: { findUnique: async ({ where }: any) => db.users.find((u: any) => u.id === where.id) ?? null },
    leaveType: { findMany: async () => db.types },
    publicHoliday: { findMany: async ({ where }: any) => db.holidays.filter((h: any) => match(h, where, db)) },
    appSetting: { upsert: async () => db.settings },
    leave: {
      findFirst: async ({ where }: any) => db.leaves.find((l: any) => match(l, where, db)) ?? null,
      findMany: async ({ where }: any) => db.leaves.filter((l: any) => match(l, where, db)),
      findUnique: async ({ where }: any) => {
        const l = find(where.id);
        return l ? { ...l, user: db.users.find((u: any) => u.id === l.userId) } : null;
      },
      create: async ({ data }: any) => {
        const l = { id: db.nextId++, status: 'PENDING', ...data };
        db.leaves.push(l);
        return l;
      },
      update: async ({ where, data }: any) => {
        const l = find(where.id);
        applyData(l, data);
        return l;
      },
    },
    leaveBalance: {
      findUnique: async ({ where }: any) => bal(where.userId_type) ?? null,
      create: async ({ data }: any) => {
        const b = { used: 0, ...data };
        db.balances.push(b);
        return b;
      },
      updateMany: async ({ where, data }: any) => {
        db.balances.filter((b: any) => match(b, where, db)).forEach((b: any) => applyData(b, data));
      },
      upsert: async ({ where, update, create }: any) => {
        const b = bal(where.userId_type);
        if (b) applyData(b, update);
        else db.balances.push({ ...create });
      },
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  };
  return db;
}

// ---------- date helpers (always in the future so notice rule passes) ----------
function nextMonday(minDaysAhead = 14): Date {
  const d = parseDay(new Date());
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const iso = (base: Date, offset = 0) => toDateKey(new Date(base.getTime() + offset * DAY_MS));
const reqOf = (id: number, role = 'EMPLOYEE') => ({ user: { id, role } });

describe('LeavesController business rules', () => {
  let db: any;
  let ctrl: LeavesController;
  let monday: Date;

  beforeEach(() => {
    db = makeDb();
    ctrl = new LeavesController(db.prisma as any);
    monday = nextMonday();
  });

  const apply = (userId: number, startOffset: number, endOffset: number, type = 'ANNUAL') =>
    ctrl.apply(reqOf(userId), {
      type,
      startDate: iso(monday, startOffset),
      endDate: iso(monday, endOffset),
      reason: 'test',
    });

  it('does not count weekends: Friday to Monday is 2 days', async () => {
    const leave: any = await apply(2, -3, 0);
    expect(leave.days).toBe(2);
  });

  it('does not count public holidays', async () => {
    db.holidays.push({ name: 'Holiday', date: parseDay(iso(monday, 2)) });
    const leave: any = await apply(2, 1, 3); // Tue to Thu, Wed is a holiday
    expect(leave.days).toBe(2);
  });

  it('rejects a request that has no working days', async () => {
    await expect(apply(2, -2, -1)).rejects.toThrow('no working days');
  });

  it('rejects end date before start date', async () => {
    await expect(apply(2, 3, 1)).rejects.toThrow('End date cannot be before start date');
  });

  it('counts pending requests against the balance', async () => {
    await apply(2, 0, 3); // 4 days pending, allowance 5
    await expect(apply(2, 7, 8)).rejects.toThrow('Not enough leave balance');
  });

  it('rejects overlapping requests for the same employee', async () => {
    await apply(2, 0, 1);
    await expect(apply(2, 1, 2)).rejects.toThrow('overlapping');
  });

  it('enforces the max team members off per day', async () => {
    db.settings.maxTeamMembersOffPerDay = 1;
    await apply(2, 0, 1);
    await expect(apply(3, 1, 2)).rejects.toThrow('Too many team members');
  });

  it('changing the configured max changes the behaviour without code change', async () => {
    db.settings.maxTeamMembersOffPerDay = 1;
    await apply(2, 0, 1);
    await expect(apply(3, 0, 1)).rejects.toThrow('Too many team members');
    db.settings.maxTeamMembersOffPerDay = 2;
    await expect(apply(3, 0, 1)).resolves.toBeDefined();
  });

  it('enforces the configured minimum notice days', async () => {
    db.settings.minimumNoticeDays = 60;
    await expect(apply(2, 0, 1)).rejects.toThrow('in advance');
  });

  it('unpaid leave does not need a balance', async () => {
    await expect(apply(2, 0, 3, 'UNPAID')).resolves.toBeDefined();
  });

  it('cancelling an approved request restores the balance', async () => {
    const leave: any = await apply(2, 0, 1); // 2 days
    await ctrl.decide(String(leave.id), 'approve', reqOf(1, 'MANAGER'));
    expect(db.balances.find((b: any) => b.userId === 2).used).toBe(2);

    await ctrl.cancel(String(leave.id), reqOf(2));
    expect(db.balances.find((b: any) => b.userId === 2).used).toBe(0);
    expect(db.leaves[0].status).toBe('CANCELLED');
  });

  it('a cancelled pending request frees the balance and the dates', async () => {
    const leave: any = await apply(2, 0, 3); // 4 of 5 days pending
    await ctrl.cancel(String(leave.id), reqOf(2));
    await expect(apply(2, 0, 3)).resolves.toBeDefined();
  });

  it('only the owner or an admin can cancel a request', async () => {
    const leave: any = await apply(2, 0, 1);
    await expect(ctrl.cancel(String(leave.id), reqOf(3))).rejects.toThrow();
  });

  it('a manager cannot decide on requests from someone else\'s reports', async () => {
    const leave: any = await apply(2, 0, 1);
    await expect(ctrl.decide(String(leave.id), 'approve', reqOf(99, 'MANAGER'))).rejects.toThrow();
  });
});