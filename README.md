# Leave Management System

A full-stack Leave Management System built using Angular 21, NestJS 12, Prisma 6 and PostgreSQL.

## Features

- JWT authentication and role-based access control.
- Employee, Manager and Admin roles.
- Leave balance management.
- Working-day calculation excluding weekends and public holidays.
- Prevention of overlapping leave requests.
- Team maximum employees-off-per-day rule.
- Minimum notice period validation.
- Manager and Admin leave approval/rejection.
- Leave cancellation and balance restoration.
- Admin settings for leave allowances and team rules.
- Balance summary with charts.
- Team leave calendar.

## Technology Stack

**Frontend:** Angular 21

**Backend:** NestJS 12, Node.js

**Database:** PostgreSQL

**ORM:** Prisma 6

**Authentication:** JWT

**Testing:** Jest

## Project Structure

- `backend/` – NestJS API, Prisma schema, database and tests.
- `frontend/` – Angular application.
- `README.md` – Project documentation.

## Architecture

The Angular frontend communicates with the NestJS REST API through HTTP requests.

- **Frontend:** Angular handles the user interface and user interactions.
- **Backend:** NestJS handles authentication, authorization, business logic and validation.
- **Database:** PostgreSQL stores user accounts, leave requests, leave types, holidays and system settings.
- **ORM:** Prisma manages database operations.
- **Security:** JWT tokens protect authenticated API endpoints, and role-based access control restricts permissions.

## Data Model

The main data models used in this project are:

- **User:** Stores employee, manager and admin account details and roles.
- **LeaveType:** Stores leave categories and allowance details.
- **LeaveRequest:** Stores leave applications, dates, reasons and approval status.
- **Holiday:** Stores public holidays used in working-day calculations.
- **Settings:** Stores admin-configurable leave rules and team limits.

## Environment Setup

Create a PostgreSQL database named `leave_management`.

Inside the backend folder, copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `JWT_SECRET`

Never commit `.env` or real credentials to GitHub.

## Run Backend

```bash
cd backend
npm install
npx prisma migrate dev
node seed.js
npm run start:dev
```

Backend: `http://localhost:3000`

## Run Frontend

Open another terminal:

```bash
cd frontend
npm install
npm start
```

Frontend: `http://localhost:4200`

## Run Tests

Inside the backend folder:

```bash
npm test
```

The project includes 24 Jest tests.

## Demo Login Credentials

All seeded users use the password:

`Pass@123`

- **Admin:** `admin@test.com`
- **Manager:** `manager1@test.com`
- **Manager:** `manager2@test.com`
- **Employees:** `employee1@test.com` to `employee8@test.com`

## Roles and Permissions

- Employees can submit, view and cancel their own leave requests.
- Managers can review leave requests from their assigned team.
- Admins can manage system settings and review all leave requests.

## Security

- Passwords are hashed.
- JWT authentication protects API routes.
- Role-based authorization is enforced on the server.
- Environment secrets must remain private.
