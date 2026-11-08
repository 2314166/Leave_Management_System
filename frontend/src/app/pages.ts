import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';

const API_URL = 'http://localhost:3000';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

/** Reads { id, role, name } from the JWT. Returns null when missing or expired. */
function tokenPayload(): any | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function errorText(error: any, fallback: string): string {
  if (error?.name === 'TimeoutError') return 'Request timed out. Please check backend.';
  if (error?.status === 0) return 'Cannot connect to backend. Check server.';
  if (error?.status === 401) return 'Session expired. Please login again.';
  const m = error?.error?.message;
  return Array.isArray(m) ? m.join(', ') : m || fallback;
}

/* ------------------------------------------------------------------ */
/* Layout with built-in login                                          */
/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="layout" *ngIf="user; else loginView">
      <aside class="sidebar">
        <h2>LeaveEase</h2>
        <p>Leave Management</p>
        <nav>
          <a routerLink="/leaves">My Leaves</a>
          <a routerLink="/approvals"
            *ngIf="user.role === 'MANAGER' || user.role === 'ADMIN'">Approvals</a>
          <a routerLink="/calendar">Team Calendar</a>
          <a routerLink="/admin" *ngIf="user.role === 'ADMIN'">Admin</a>
        </nav>
      </aside>

      <main class="content">
        <header>
          <h2>Leave Management System</h2>
          <div class="who">
            <span>{{ user.name }} ({{ user.role }})</span>
            <button (click)="logout()">Logout</button>
          </div>
        </header>
        <router-outlet></router-outlet>
      </main>
    </div>

    <ng-template #loginView>
      <div class="login-page">
        <form class="login-card" (ngSubmit)="login()">
          <h2>LeaveEase</h2>
          <p>Sign in to continue</p>

          <label>Email</label>
          <input type="email" [(ngModel)]="email" name="email" required>

          <label>Password</label>
          <input type="password" [(ngModel)]="password" name="password" required>

          <button type="submit" [disabled]="busy">
            {{ busy ? 'Signing in...' : 'Login' }}
          </button>
          <p class="error">{{ error }}</p>
        </form>
      </div>
    </ng-template>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      background: #f4f6fb;
    }
    .sidebar {
      width: 220px;
      background: #172554;
      color: white;
      padding: 25px 18px;
    }
    .sidebar h2 { margin-top: 0; }
    .sidebar nav {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 35px;
    }
    .sidebar a {
      color: white;
      text-decoration: none;
      padding: 12px;
      border-radius: 6px;
    }
    .sidebar a:hover { background: #334b85; }
    .content { flex: 1; padding: 25px; }
    header {
      background: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h2 { margin: 0; }
    .who { display: flex; align-items: center; gap: 12px; }
    .who button {
      padding: 8px 14px;
      background: #dc2626;
      color: white;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
    }
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f4f6fb;
      font-family: Arial, sans-serif;
    }
    .login-card {
      background: white;
      padding: 30px;
      border-radius: 10px;
      width: 340px;
    }
    .login-card h2 { margin: 0 0 4px; }
    .login-card label { display: block; margin-top: 14px; }
    .login-card input {
      display: block;
      width: 100%;
      padding: 10px;
      margin-top: 5px;
      box-sizing: border-box;
    }
    .login-card button {
      margin-top: 20px;
      width: 100%;
      padding: 11px;
      background: #2563eb;
      color: white;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
    }
    .login-card button:disabled { background: #888; }
    .error { color: #dc2626; font-weight: bold; }
  `]
})
export class Layout {
  user: any = tokenPayload();
  email = '';
  password = '';
  error = '';
  busy = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  login() {
    if (!this.email || !this.password) {
      this.error = 'Enter email and password.';
      return;
    }
    this.busy = true;
    this.error = '';

    this.http.post<any>(`${API_URL}/auth/login`, {
      email: this.email,
      password: this.password
    }).pipe(timeout(10000)).subscribe({
      next: (data) => {
        localStorage.setItem('token', data.token);
        this.user = tokenPayload();
        this.password = '';
        this.busy = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = errorText(error, 'Login failed.');
        this.busy = false;
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    this.user = null;
    this.cdr.detectChanges();
  }
}

/* ------------------------------------------------------------------ */
/* My Leaves: apply, balance summary + chart, cancel                   */
/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-my-leaves',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>My Leaves</h2>

    <div class="card">
      <h3>Leave Balance</h3>
      <p *ngIf="!balances.length">Loading balance...</p>

      <div *ngFor="let b of balances" class="bal">
        <div class="bal-head">
          <b>{{ b.type }}</b>
          <span *ngIf="b.isPaid">{{ b.remaining }} of {{ b.total }} days left</span>
          <span *ngIf="!b.isPaid">No balance limit</span>
        </div>
        <div class="bar" *ngIf="b.isPaid && b.total > 0">
          <div class="seg used" [style.width.%]="pct(b.used, b.total)"></div>
          <div class="seg pending" [style.width.%]="pct(b.pending, b.total)"></div>
        </div>
        <small *ngIf="b.isPaid">
          Used {{ b.used }} · Pending {{ b.pending }} · Remaining {{ b.remaining }}
        </small>
      </div>

      <div class="legend">
        <span><i class="dot used"></i> Used</span>
        <span><i class="dot pending"></i> Pending</span>
        <span><i class="dot free"></i> Remaining</span>
      </div>
    </div>

    <div class="card">
      <h3>Apply for Leave</h3>

      <form (ngSubmit)="submitLeave()">
        <label>Leave Type</label>
        <select [(ngModel)]="leave.type" name="type" required>
          <option *ngFor="let t of types" [value]="t.name.toUpperCase()">{{ t.name }}</option>
        </select>

        <label>Start Date</label>
        <input type="date" [(ngModel)]="leave.startDate"
          name="startDate" required>

        <label>End Date</label>
        <input type="date" [(ngModel)]="leave.endDate"
          name="endDate" required>

        <label>Reason</label>
        <textarea [(ngModel)]="leave.reason"
          name="reason" required></textarea>

        <button type="submit" [disabled]="loading">
          {{ loading ? 'Submitting...' : 'Submit Request' }}
        </button>
      </form>

      <p class="message">{{ message }}</p>
    </div>

    <div class="card">
      <h3>My Leave Requests</h3>
      <p>{{ requestMessage }}</p>

      <div *ngFor="let item of requests" class="request">
        <p><b>Type:</b> {{ item.type }}</p>
        <p><b>Start:</b> {{ item.startDate | date:'mediumDate':'UTC' }}</p>
        <p><b>End:</b> {{ item.endDate | date:'mediumDate':'UTC' }}</p>
        <p><b>Days:</b> {{ item.days }}</p>
        <p><b>Status:</b>
          <span class="badge" [ngClass]="item.status">{{ item.status }}</span>
        </p>
        <button class="cancel"
          *ngIf="item.status === 'PENDING' || item.status === 'APPROVED'"
          [disabled]="busyId === item.id"
          (click)="cancel(item.id)">Cancel request</button>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      padding: 22px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-top: 12px;
    }
    input, select, textarea {
      display: block;
      width: 100%;
      max-width: 450px;
      padding: 10px;
      margin-top: 5px;
      box-sizing: border-box;
    }
    button {
      margin-top: 18px;
      padding: 11px 22px;
      background: #2563eb;
      color: white;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
    }
    button:disabled {
      background: #888;
      cursor: not-allowed;
    }
    button.cancel { background: #dc2626; margin-top: 6px; padding: 8px 16px; }
    .message { font-weight: bold; }
    .request {
      border: 1px solid #ddd;
      padding: 12px;
      margin-top: 12px;
      border-radius: 6px;
    }
    .request p { margin: 6px 0; }
    .badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 13px;
      color: white;
      background: #6b7280;
    }
    .badge.PENDING { background: #d97706; }
    .badge.APPROVED { background: #16a34a; }
    .badge.REJECTED { background: #dc2626; }
    .badge.CANCELLED { background: #6b7280; }
    .bal { margin-bottom: 16px; max-width: 520px; }
    .bal-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .bar {
      display: flex;
      height: 14px;
      background: #bbf7d0;
      border-radius: 7px;
      overflow: hidden;
    }
    .seg.used { background: #2563eb; }
    .seg.pending { background: #f59e0b; }
    .legend { display: flex; gap: 16px; margin-top: 8px; font-size: 13px; }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 4px;
    }
    .dot.used { background: #2563eb; }
    .dot.pending { background: #f59e0b; }
    .dot.free { background: #bbf7d0; }
  `]
})
export class MyLeaves implements OnInit {
  leave = {
    type: 'ANNUAL',
    startDate: '',
    endDate: '',
    reason: ''
  };

  types: any[] = [];
  balances: any[] = [];
  message = '';
  requestMessage = 'Loading leave requests...';
  loading = false;
  busyId: number | null = null;
  requests: any[] = [];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  pct(value: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  }

  ngOnInit() {
    this.loadTypes();
    this.loadBalance();
    this.loadLeaves();
  }

  loadTypes() {
    this.http.get<any[]>(`${API_URL}/leaves/types`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.types = data;
          const ok = data.some((t) => t.name.toUpperCase() === this.leave.type);
          if (!ok && data.length) this.leave.type = data[0].name.toUpperCase();
          this.cdr.detectChanges();
        },
        error: () => {
          this.types = [{ name: 'ANNUAL' }, { name: 'SICK' }, { name: 'UNPAID' }];
          this.cdr.detectChanges();
        }
      });
  }

  loadBalance() {
    this.http.get<any[]>(`${API_URL}/leaves/balance`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.balances = data;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Load balance error:', error);
        }
      });
  }

  loadLeaves() {
    if (!localStorage.getItem('token')) {
      this.requestMessage = 'Please login first.';
      this.cdr.detectChanges();
      return;
    }

    this.http.get<any[]>(`${API_URL}/leaves/my`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.requests = data;
          this.requestMessage = data.length ? '' : 'No leave requests found.';
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Load leaves error:', error);
          this.requestMessage = 'Unable to load leave requests.';
          this.cdr.detectChanges();
        }
      });
  }

  submitLeave() {
    if (this.loading) return;

    if (
      !this.leave.startDate ||
      !this.leave.endDate ||
      !this.leave.reason.trim()
    ) {
      this.message = 'Please fill all fields.';
      return;
    }

    if (this.leave.endDate < this.leave.startDate) {
      this.message = 'End date cannot be before start date.';
      return;
    }

    this.loading = true;
    this.message = 'Submitting your leave request...';

    this.http.post(`${API_URL}/leaves`, this.leave, { headers: authHeaders() })
      .pipe(timeout(15000)).subscribe({
        next: () => {
          this.message = 'Leave request submitted successfully!';
          this.leave = {
            type: this.leave.type,
            startDate: '',
            endDate: '',
            reason: ''
          };
          this.loading = false;
          this.cdr.detectChanges();
          this.loadLeaves();
          this.loadBalance();
        },
        error: (error) => {
          console.error('Leave submission error:', error);
          this.message = errorText(error, 'Leave submission failed.');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  cancel(id: number) {
    this.busyId = id;
    this.message = '';

    this.http.patch(`${API_URL}/leaves/${id}/cancel`, {}, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: () => {
          this.busyId = null;
          this.message = 'Leave cancelled. Days returned to your balance.';
          this.cdr.detectChanges();
          this.loadLeaves();
          this.loadBalance();
        },
        error: (error) => {
          console.error('Cancel error:', error);
          this.busyId = null;
          this.message = errorText(error, 'Could not cancel the request.');
          this.cdr.detectChanges();
        }
      });
  }
}

/* ------------------------------------------------------------------ */
/* Approvals (manager / admin)                                         */
/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Manager Approvals</h2>
    <div class="card">
      <h3>Pending Leave Requests</h3>
      <p class="message">{{ message }}</p>

      <div *ngFor="let item of pending" class="request">
        <p><b>Employee:</b> {{ item.user?.name }} ({{ item.user?.email }})</p>
        <p><b>Type:</b> {{ item.type }}</p>
        <p><b>Start:</b> {{ item.startDate | date:'mediumDate':'UTC' }}</p>
        <p><b>End:</b> {{ item.endDate | date:'mediumDate':'UTC' }}</p>
        <p><b>Days:</b> {{ item.days }}</p>
        <p><b>Reason:</b> {{ item.reason }}</p>

        <button class="approve" [disabled]="busyId === item.id"
          (click)="decide(item.id, 'approve')">Approve</button>
        <button class="reject" [disabled]="busyId === item.id"
          (click)="decide(item.id, 'reject')">Reject</button>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      padding: 22px;
      border-radius: 10px;
    }
    .message { font-weight: bold; }
    .request {
      border: 1px solid #ddd;
      padding: 12px;
      margin-top: 12px;
      border-radius: 6px;
    }
    .request p { margin: 6px 0; }
    button {
      margin-top: 8px;
      margin-right: 10px;
      padding: 9px 18px;
      color: white;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
    }
    button:disabled { background: #888 !important; cursor: not-allowed; }
    .approve { background: #16a34a; }
    .reject { background: #dc2626; }
  `]
})
export class Approvals implements OnInit {
  pending: any[] = [];
  message = 'Loading pending requests...';
  busyId: number | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<any[]>(`${API_URL}/leaves/pending`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.pending = data;
          this.message = data.length ? '' : 'No pending leave requests.';
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Load pending error:', error);
          this.message = error.status === 403
            ? 'Only Manager or Admin can view approvals.'
            : errorText(error, 'Unable to load pending requests.');
          this.cdr.detectChanges();
        }
      });
  }

  decide(id: number, action: 'approve' | 'reject') {
    this.busyId = id;
    this.message = '';

    this.http.patch(`${API_URL}/leaves/${id}/${action}`, {}, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: () => {
          this.busyId = null;
          this.message = action === 'approve' ? 'Leave approved.' : 'Leave rejected.';
          this.pending = this.pending.filter((p) => p.id !== id);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Decision error:', error);
          this.busyId = null;
          this.message = errorText(error, 'Action failed.');
          this.cdr.detectChanges();
        }
      });
  }
}

/* ------------------------------------------------------------------ */
/* Team calendar                                                       */
/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-team-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Team Calendar</h2>
    <div class="card">
      <h3>Approved Leaves</h3>
      <p class="message">{{ message }}</p>

      <div *ngFor="let item of leaves" class="request">
        <p><b>{{ item.user?.name }}</b> - {{ item.type }}</p>
        <p>{{ item.startDate | date:'mediumDate':'UTC' }} to
          {{ item.endDate | date:'mediumDate':'UTC' }}
          ({{ item.days }} day(s))</p>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      padding: 22px;
      border-radius: 10px;
    }
    .message { font-weight: bold; }
    .request {
      border: 1px solid #ddd;
      padding: 12px;
      margin-top: 12px;
      border-radius: 6px;
    }
    .request p { margin: 4px 0; }
  `]
})
export class TeamCalendar implements OnInit {
  leaves: any[] = [];
  message = 'Loading team calendar...';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.http.get<any[]>(`${API_URL}/leaves/calendar`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.leaves = data;
          this.message = data.length ? '' : 'No approved leaves yet.';
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Load calendar error:', error);
          this.message = errorText(error, 'Unable to load team calendar.');
          this.cdr.detectChanges();
        }
      });
  }
}

/* ------------------------------------------------------------------ */
/* Admin settings (saved in the database, used by the business rules)  */
/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Admin Settings</h2>
    <div class="card">
      <h3>Leave Configuration</h3>
      <p *ngIf="!settings" class="message">{{ message }}</p>

      <div *ngIf="settings">
        <h4>Yearly allowance per leave type</h4>
        <div *ngFor="let t of settings.leaveTypes">
          <label>{{ t.name }} {{ t.isPaid ? '' : '(unpaid, no limit)' }}</label>
          <input type="number" min="0" [(ngModel)]="t.yearlyAllowance"
            [name]="'allowance-' + t.name">
        </div>

        <h4>Rules</h4>
        <label>Minimum Notice Days</label>
        <input type="number" min="0" [(ngModel)]="settings.minimumNoticeDays"
          name="notice">

        <label>Maximum Team Members Off Per Day</label>
        <input type="number" min="1" [(ngModel)]="settings.maxTeamMembersOffPerDay"
          name="maximum">

        <button (click)="save()" [disabled]="saving">
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <p class="message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      padding: 22px;
      border-radius: 10px;
    }
    label {
      display: block;
      margin-top: 12px;
    }
    input {
      display: block;
      width: 100%;
      max-width: 350px;
      padding: 10px;
      margin-top: 5px;
      box-sizing: border-box;
    }
    button {
      margin-top: 18px;
      padding: 11px 22px;
      background: #2563eb;
      color: white;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
    }
    button:disabled { background: #888; cursor: not-allowed; }
    .message { font-weight: bold; }
  `]
})
export class Admin implements OnInit {
  settings: any = null;
  message = 'Loading settings...';
  saving = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.http.get<any>(`${API_URL}/admin/settings`, { headers: authHeaders() })
      .pipe(timeout(10000)).subscribe({
        next: (data) => {
          this.settings = data;
          this.message = '';
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Load settings error:', error);
          this.message = error.status === 403
            ? 'Only Admin can view settings. Please login as admin.'
            : errorText(error, 'Unable to load settings.');
          this.cdr.detectChanges();
        }
      });
  }

  save() {
    this.saving = true;
    this.message = '';

    this.http.put<any>(`${API_URL}/admin/settings`, {
      minimumNoticeDays: Number(this.settings.minimumNoticeDays),
      maxTeamMembersOffPerDay: Number(this.settings.maxTeamMembersOffPerDay),
      leaveTypes: this.settings.leaveTypes.map((t: any) => ({
        name: t.name,
        yearlyAllowance: Number(t.yearlyAllowance)
      }))
    }, { headers: authHeaders() }).pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.settings = data;
        this.saving = false;
        this.message = 'Settings saved. New rules apply immediately.';
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Save settings error:', error);
        this.saving = false;
        this.message = errorText(error, 'Could not save settings.');
        this.cdr.detectChanges();
      }
    });
  }
}