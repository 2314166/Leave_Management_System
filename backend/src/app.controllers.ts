import {
  BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException,
  Get, Injectable, Param, Patch, Post, Put, Req, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';
import {
  firstOverCapacityDay, noticeDays, parseDay, remainingBalance, toDateKey, workingDays,
} from './leave-rules';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
const DEFAULTS: [string, number][] = [['CASUAL', 12], ['SICK', 10], ['EARNED', 15]];
const ACTIVE: any = ['PENDING', 'APPROVED'];

function toCount(value: any, name: string, min = 0): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new BadRequestException(`${name} must be a whole number of at least ${min}`);
  }
  return n;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try {
      req.user = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  @Post('login')
  async login(@Body() b: any) {
    const u = await this.prisma.user.findUnique({ where: { email: b.email } });
    if (!u || !(await bcrypt.compare(b.password, u.password)))
      throw new UnauthorizedException('Invalid email or password');
    const token = this.jwt.sign({ id: u.id, role: u.role, name: u.name });
    return { token, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }
}

@Controller('leaves')
@UseGuards(AuthGuard)
export class LeavesController {
  constructor(private prisma: PrismaService) {}

  private getSettings() {
    return this.prisma.appSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  @Get('types')
  async types() {
    return this.prisma.leaveType.findMany({ orderBy: { id: 'asc' } });
  }

  @Post()
  async apply(@Req() req: any, @Body() b: any) {
    const userId: number = req.user.id;
    const start = parseDay(b.startDate);
    const end = parseDay(b.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Invalid dates');
    if (end < start) throw new BadRequestException('End date cannot be before start date');

    const type = String(b.type || '').toUpperCase();
    const allTypes = await this.prisma.leaveType.findMany();
    const leaveType = allTypes.find((t: any) => t.name.toUpperCase() === type);
    let balance = await this.prisma.leaveBalance.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (!leaveType && !balance) throw new BadRequestException('Unknown leave type');
    const isPaid = leaveType ? leaveType.isPaid : type !== 'UNPAID';

    // Minimum notice (admin configurable)
    const settings = await this.getSettings();
    const today = parseDay(new Date());
    if (noticeDays(today, start) < settings.minimumNoticeDays) {
      throw new BadRequestException(
        `Leave must be requested at least ${settings.minimumNoticeDays} day(s) in advance`,
      );
    }

    // Weekends and public holidays do not count
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { date: { gte: start, lte: end } },
    });
    const days = workingDays(start, end, holidays.map((h: any) => toDateKey(h.date)));
    if (!days.length) {
      throw new BadRequestException(
        'Selected dates have no working days (weekends and public holidays are excluded)',
      );
    }

    // Overlap rule 1: employee cannot have overlapping requests
    const mine = await this.prisma.leave.findFirst({
      where: { userId, status: { in: ACTIVE }, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (mine) throw new BadRequestException('You already have a leave request overlapping these dates');

    // Balance rule: pending requests count against the balance
    if (isPaid) {
      if (!balance) {
        balance = await this.prisma.leaveBalance.create({
          data: { userId, type, total: leaveType ? leaveType.yearlyAllowance : 0 },
        });
      }
      const pendingLeaves = await this.prisma.leave.findMany({
        where: { userId, type, status: 'PENDING' },
      });
      const pending = pendingLeaves.reduce((sum: number, l: any) => sum + l.days, 0);
      const remaining = remainingBalance(balance.total, balance.used, pending);
      if (remaining < days.length) {
        throw new BadRequestException(
          `Not enough leave balance (remaining ${remaining}, requested ${days.length})`,
        );
      }
    }

    // Overlap rule 2: max team members off on the same day (admin configurable)
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    const teamFilter: any = me!.managerId
      ? { managerId: me!.managerId }
      : me!.role === 'MANAGER'
        ? { managerId: me!.id }
        : null;
    if (teamFilter) {
      const others = await this.prisma.leave.findMany({
        where: {
          status: { in: ACTIVE },
          startDate: { lte: end },
          endDate: { gte: start },
          user: { ...teamFilter, id: { not: userId } },
        },
        select: { startDate: true, endDate: true },
      });
      const bad = firstOverCapacityDay(days, others as any[], settings.maxTeamMembersOffPerDay);
      if (bad) {
        throw new BadRequestException(
          `Too many team members are already off on ${bad} (maximum ${settings.maxTeamMembersOffPerDay})`,
        );
      }
    }

    return this.prisma.leave.create({
      data: { userId, type, startDate: start, endDate: end, days: days.length, reason: b.reason },
    });
  }

  @Get('my')
  my(@Req() req: any) {
    return this.prisma.leave.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  }

  /** Balance summary per leave type: total, used (approved), pending, remaining. */
  @Get('balance')
  async balance(@Req() req: any) {
    const userId: number = req.user.id;
    const [types, balances, pendingLeaves] = await Promise.all([
      this.prisma.leaveType.findMany(),
      this.prisma.leaveBalance.findMany({ where: { userId } }),
      this.prisma.leave.findMany({ where: { userId, status: 'PENDING' } }),
    ]);
    const names = new Set<string>([
      ...types.map((t: any) => t.name.toUpperCase()),
      ...balances.map((b: any) => b.type),
    ]);
    return [...names].map((type) => {
      const lt: any = types.find((t: any) => t.name.toUpperCase() === type);
      const bal: any = balances.find((b: any) => b.type === type);
      const total = bal ? bal.total : lt ? lt.yearlyAllowance : 0;
      const used = bal ? bal.used : 0;
      const pending = pendingLeaves
        .filter((l: any) => l.type === type)
        .reduce((sum: number, l: any) => sum + l.days, 0);
      return {
        type,
        isPaid: lt ? lt.isPaid : type !== 'UNPAID',
        total,
        used,
        pending,
        remaining: remainingBalance(total, used, pending),
      };
    });
  }

  @Get('pending')
  @Roles('MANAGER', 'ADMIN')
  pending(@Req() req: any) {
    const where: any = { status: 'PENDING' };
    if (req.user.role === 'MANAGER') where.user = { managerId: req.user.id };
    return this.prisma.leave.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('calendar')
  async calendar(@Req() req: any) {
    const where: any = { status: 'APPROVED' };
    if (req.user.role !== 'ADMIN') {
      const me = await this.prisma.user.findUnique({ where: { id: req.user.id } });
      const mid = me!.role === 'MANAGER' ? me!.id : me!.managerId;
      if (mid) where.user = { OR: [{ managerId: mid }, { id: mid }] };
      else where.userId = req.user.id;
    }
    return this.prisma.leave.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Employee (owner) or admin cancels. Cancelling an approved leave returns the days. */
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any) {
    const leave = await this.prisma.leave.findUnique({ where: { id: +id } });
    if (!leave) throw new BadRequestException('Leave not found');
    if (leave.userId !== req.user.id && req.user.role !== 'ADMIN') throw new ForbiddenException();
    if (!['PENDING', 'APPROVED'].includes(leave.status)) {
      throw new BadRequestException('Only pending or approved requests can be cancelled');
    }
    const ops: any[] = [
      this.prisma.leave.update({ where: { id: leave.id }, data: { status: 'CANCELLED' } }),
    ];
    if (leave.status === 'APPROVED') {
      ops.push(
        this.prisma.leaveBalance.updateMany({
          where: { userId: leave.userId, type: leave.type },
          data: { used: { decrement: leave.days } },
        }),
      );
    }
    const [updated] = await this.prisma.$transaction(ops);
    return updated;
  }

  @Patch(':id/:action')
  @Roles('MANAGER', 'ADMIN')
  async decide(@Param('id') id: string, @Param('action') action: string, @Req() req: any) {
    if (!['approve', 'reject'].includes(action)) throw new BadRequestException('Bad action');
    const leave = await this.prisma.leave.findUnique({ where: { id: +id }, include: { user: true } });
    if (!leave) throw new BadRequestException('Leave not found');
    if (leave.status !== 'PENDING') throw new BadRequestException('Already processed');
    if (req.user.role === 'MANAGER' && leave.user.managerId !== req.user.id) throw new ForbiddenException();
    if (action === 'reject')
      return this.prisma.leave.update({ where: { id: leave.id }, data: { status: 'REJECTED' } });
    const [updated] = await this.prisma.$transaction([
      this.prisma.leave.update({ where: { id: leave.id }, data: { status: 'APPROVED' } }),
      this.prisma.leaveBalance.upsert({
        where: { userId_type: { userId: leave.userId, type: leave.type } },
        update: { used: { increment: leave.days } },
        create: { userId: leave.userId, type: leave.type, total: 0, used: leave.days },
      }),
    ]);
    return updated;
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  @Roles('ADMIN')
  async stats() {
    const [users, pending, approved, rejected] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.leave.count({ where: { status: 'PENDING' } }),
      this.prisma.leave.count({ where: { status: 'APPROVED' } }),
      this.prisma.leave.count({ where: { status: 'REJECTED' } }),
    ]);
    return { users, pending, approved, rejected };
  }

  @Get('settings')
  @Roles('ADMIN')
  async settings() {
    const settings = await this.prisma.appSetting.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    const leaveTypes = await this.prisma.leaveType.findMany({ orderBy: { id: 'asc' } });
    return { ...settings, leaveTypes };
  }

  /** Body: { minimumNoticeDays, maxTeamMembersOffPerDay, leaveTypes: [{ name, yearlyAllowance }] } */
  @Put('settings')
  @Roles('ADMIN')
  async updateSettings(@Body() b: any) {
    const data: any = {};
    if (b.minimumNoticeDays !== undefined)
      data.minimumNoticeDays = toCount(b.minimumNoticeDays, 'minimumNoticeDays');
    if (b.maxTeamMembersOffPerDay !== undefined)
      data.maxTeamMembersOffPerDay = toCount(b.maxTeamMembersOffPerDay, 'maxTeamMembersOffPerDay', 1);
    await this.prisma.appSetting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

    for (const t of b.leaveTypes || []) {
      const total = toCount(t.yearlyAllowance, `${t.name} allowance`);
      await this.prisma.leaveType.update({ where: { name: t.name }, data: { yearlyAllowance: total } });
      await this.prisma.leaveBalance.updateMany({
        where: { type: String(t.name).toUpperCase() },
        data: { total },
      });
    }
    return this.settings();
  }

  @Get('users')
  @Roles('ADMIN')
  users() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, managerId: true },
      orderBy: { id: 'asc' },
    });
  }

  @Post('users')
  @Roles('ADMIN')
  async create(@Body() b: any) {
    const user = await this.prisma.user.create({
      data: {
        name: b.name,
        email: b.email,
        password: await bcrypt.hash(b.password, 10),
        role: b.role || 'EMPLOYEE',
        managerId: b.managerId ? +b.managerId : null,
      },
    });
    const types = await this.prisma.leaveType.findMany();
    const allowances: [string, number][] = types.length
      ? types.map((t: any): [string, number] => [t.name.toUpperCase(), t.yearlyAllowance])
      : DEFAULTS;
    for (const [type, total] of allowances)
      await this.prisma.leaveBalance.create({ data: { userId: user.id, type, total } });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}