
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="login-wrapper">

        <section class="welcome-panel">
          <div class="brand">
            <div class="brand-icon">L</div>
            <span>LeaveEase</span>
          </div>

          <div class="welcome-content">
            <span class="tag">SMART LEAVE MANAGEMENT</span>
            <h1>Work smarter.<br>Take time to recharge.</h1>
            <p>
              A simple and intelligent way to manage employee
              leaves, team schedules and workplace productivity.
            </p>

            <div class="feature">
              <span>✓</span>
              Easy leave applications
            </div>
            <div class="feature">
              <span>✓</span>
              Quick approval workflow
            </div>
            <div class="feature">
              <span>✓</span>
              Real-time leave tracking
            </div>
          </div>

          <div class="footer-text">
            Leave management made simple.
          </div>
        </section>

        <section class="form-panel">
          <div class="form-content">
            <div class="mobile-brand">LeaveEase</div>

            <div class="welcome-icon">👋</div>
            <h2>Welcome back!</h2>
            <p class="subtitle">
              Please sign in to access your account.
            </p>

            <form (ngSubmit)="login()">
              <label>Email address</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter your email"
                required
              >

              <label>Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                placeholder="Enter your password"
                required
              >

              <p class="message" *ngIf="message">
                {{ message }}
              </p>

              <button type="submit" [disabled]="loading">
                {{ loading ? 'Signing in...' : 'Sign In →' }}
              </button>
            </form>

            <p class="security">
              🔒 Secure employee access
            </p>
          </div>
        </section>

      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .page {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 30px;
      background: #eef2ff;
      font-family: Arial, sans-serif;
    }

    .login-wrapper {
      width: 100%;
      max-width: 1050px;
      min-height: 620px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: white;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(30, 41, 90, .13);
    }

    .welcome-panel {
      padding: 45px;
      background: linear-gradient(145deg, #172554, #1d4ed8);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 25px;
      font-weight: bold;
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: white;
      color: #1d4ed8;
      display: grid;
      place-items: center;
      font-size: 25px;
    }

    .tag {
      font-size: 11px;
      letter-spacing: 2px;
      color: #bfdbfe;
      font-weight: bold;
    }

    .welcome-content h1 {
      font-size: 38px;
      line-height: 1.25;
      margin: 20px 0;
    }

    .welcome-content p {
      color: #dbeafe;
      line-height: 1.8;
      font-size: 14px;
      margin-bottom: 28px;
    }

    .feature {
      margin-top: 17px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
    }

    .feature span {
      width: 23px;
      height: 23px;
      display: grid;
      place-items: center;
      background: #2563eb;
      border-radius: 50%;
    }

    .footer-text {
      font-size: 12px;
      color: #bfdbfe;
    }

    .form-panel {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 45px;
    }

    .form-content {
      width: 100%;
      max-width: 360px;
    }

    .mobile-brand {
      display: none;
    }

    .welcome-icon {
      font-size: 35px;
      margin-bottom: 15px;
    }

    h2 {
      color: #172554;
      font-size: 30px;
      margin: 0 0 10px;
    }

    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 35px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: bold;
      color: #334155;
      margin: 20px 0 8px;
    }

    input {
      width: 100%;
      padding: 14px;
      border: 1px solid #dbe2ef;
      border-radius: 9px;
      outline: none;
      font-size: 14px;
      background: #f8fafc;
    }

    input:focus {
      border-color: #2563eb;
      background: white;
      box-shadow: 0 0 0 3px #dbeafe;
    }

    button {
      width: 100%;
      margin-top: 25px;
      padding: 15px;
      background: #1d4ed8;
      color: white;
      border: none;
      border-radius: 9px;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      transition: .2s;
    }

    button:hover:not(:disabled) {
      background: #172554;
      transform: translateY(-2px);
    }

    button:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .message {
      color: #dc2626;
      font-size: 13px;
      margin-top: 15px;
    }

    .security {
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      margin-top: 30px;
    }

    @media(max-width: 700px) {
      .page {
        padding: 15px;
      }

      .login-wrapper {
        grid-template-columns: 1fr;
      }

      .welcome-panel {
        display: none;
      }

      .form-panel {
        padding: 35px 25px;
        min-height: 550px;
      }

      .mobile-brand {
        display: block;
        color: #1d4ed8;
        font-size: 25px;
        font-weight: bold;
        margin-bottom: 45px;
      }
    }
  `]
})
export class Login {
  email = '';
  password = '';
  message = '';
  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login() {
    if (!this.email.trim() || !this.password) {
      this.message = 'Please enter email and password.';
      return;
    }

    this.loading = true;
    this.message = '';

    this.http.post<any>(
      'http://localhost:3000/auth/login',
      {
        email: this.email,
        password: this.password
      }
    ).subscribe({
      next: (response) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        this.router.navigate(['/leaves']);
      },
      error: (error) => {
        this.message =
          error.error?.message || 'Login failed. Please try again.';
        this.loading = false;
      }
    });
  }
}
