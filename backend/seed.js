
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const p = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Pass@123', 10);

  // 1. Create Admin
  const admin = await p.user.upsert({
    where: { email: 'admin@test.com' },
    update: { role: 'ADMIN' },
    create: {
      name: 'Admin',
      email: 'admin@test.com',
      password,
      role: 'ADMIN'
    }
  });

  // 2. Create two Managers
  const managers = [];

  for (let i = 1; i <= 2; i++) {
    const manager = await p.user.upsert({
      where: { email: `manager${i}@test.com` },
      update: { role: 'MANAGER' },
      create: {
        name: `Manager ${i}`,
        email: `manager${i}@test.com`,
        password,
        role: 'MANAGER'
      }
    });

    managers.push(manager);
  }

  // 3. Create eight Employees
  const employees = [];

  for (let i = 1; i <= 8; i++) {
    const employee = await p.user.upsert({
      where: { email: `employee${i}@test.com` },
      update: {
        role: 'EMPLOYEE',
        managerId: managers[i <= 4 ? 0 : 1].id
      },
      create: {
        name: `Employee ${i}`,
        email: `employee${i}@test.com`,
        password,
        role: 'EMPLOYEE',
        managerId: managers[i <= 4 ? 0 : 1].id
      }
    });

    employees.push(employee);
  }

  // 4. Create leave types
  const leaveTypes = [
    { name: 'ANNUAL', yearlyAllowance: 15, isPaid: true },
    { name: 'SICK', yearlyAllowance: 10, isPaid: true },
    { name: 'UNPAID', yearlyAllowance: 0, isPaid: false }
  ];

  for (const type of leaveTypes) {
    await p.leaveType.upsert({
      where: { name: type.name },
      update: type,
      create: type
    });
  }

  // 5. Create leave balances
  const allUsers = [admin, ...managers, ...employees];

  for (const user of allUsers) {
    for (const type of leaveTypes) {
      await p.leaveBalance.upsert({
        where: {
          userId_type: {
            userId: user.id,
            type: type.name
          }
        },
        update: { total: type.yearlyAllowance },
        create: {
          userId: user.id,
          type: type.name,
          total: type.yearlyAllowance
        }
      });
    }
  }

  // 6. Public holidays
  const holidays = [
    { name: 'Republic Day', date: '2026-01-26' },
    { name: 'Independence Day', date: '2026-08-15' },
    { name: 'Gandhi Jayanti', date: '2026-10-02' },
    { name: 'Christmas', date: '2026-12-25' }
  ];

  for (const holiday of holidays) {
    await p.publicHoliday.upsert({
      where: { date: new Date(`${holiday.date}T00:00:00.000Z`) },
      update: { name: holiday.name },
      create: {
        name: holiday.name,
        date: new Date(`${holiday.date}T00:00:00.000Z`)
      }
    });
  }

  // 7. Application settings
  await p.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      minimumNoticeDays: 1,
      maxTeamMembersOffPerDay: 2
    }
  });

  // 8. Generate 40 sample leave requests
  function weekdaysFrom(start, count) {
    const dates = [];
    const date = new Date(`${start}T00:00:00.000Z`);

    while (dates.length < count) {
      const day = date.getUTCDay();

      if (day !== 0 && day !== 6) {
        dates.push(new Date(date));
      }

      date.setUTCDate(date.getUTCDate() + 1);
    }

    return dates;
  }

  const dateGroups = [
    weekdaysFrom('2026-01-05', 8),
    weekdaysFrom('2026-01-19', 8),
    weekdaysFrom('2026-03-02', 8),
    weekdaysFrom('2026-06-01', 8),
    weekdaysFrom('2026-11-09', 8)
  ];

  const statuses = [
    'APPROVED',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'PENDING'
  ];

  const types = ['ANNUAL', 'SICK', 'UNPAID'];

  for (let i = 0; i < employees.length; i++) {
    for (let j = 0; j < 5; j++) {
      const startDate = dateGroups[j][i];
      const endDate = new Date(startDate);

      const type = types[j % types.length];
      const status = statuses[j];

      const reason = `Seed sample request ${i + 1}-${j + 1}`;

      const existing = await p.leave.findFirst({
        where: {
          userId: employees[i].id,
          type,
          startDate,
          endDate,
          reason
        }
      });

      if (!existing) {
        await p.leave.create({
          data: {
            userId: employees[i].id,
            type,
            startDate,
            endDate,
            days: 1,
            reason,
            status
          }
        });

        if (status === 'APPROVED' && type !== 'UNPAID') {
          await p.leaveBalance.update({
            where: {
              userId_type: {
                userId: employees[i].id,
                type
              }
            },
            data: {
              used: { increment: 1 }
            }
          });
        }
      }
    }
  }

  console.log('Seed completed successfully!');
  console.log('1 Admin, 2 Managers, 8 Employees');
  console.log('3 Leave types, 4 Holidays, 40 sample requests');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
