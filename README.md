\# Leave Management System



A full-stack Leave Management System built using Angular 21, NestJS 12, Prisma 6 and PostgreSQL.



\## Features



\- JWT authentication and role-based access control.

\- Employee, Manager and Admin roles.

\- Leave balance management.

\- Working-day calculation excluding weekends and public holidays.

\- Prevention of overlapping leave requests.

\- Team maximum employees-off-per-day rule.

\- Minimum notice period validation.

\- Manager and Admin leave approval/rejection.

\- Leave cancellation and balance restoration.

\- Admin settings for leave allowances and team rules.

\- Balance summary with charts.

\- Team leave calendar.



\## Technology Stack



\*\*Frontend:\*\* Angular 21



\*\*Backend:\*\* NestJS 12, Node.js



\*\*Database:\*\* PostgreSQL



\*\*ORM:\*\* Prisma 6



\*\*Authentication:\*\* JWT



\*\*Testing:\*\* Jest



\## Project Structure



\- `backend/` – NestJS API, Prisma schema, database and tests.

\- `frontend/` – Angular application.

\- `README.md` – Project documentation.



\## Environment Setup



Create a PostgreSQL database named `leave\_management`.



Inside the backend folder, copy `.env.example` to `.env` and configure:



\- `DATABASE\_URL`

\- `JWT\_SECRET`



Never commit `.env` or real credentials to GitHub.



\## Run Backend



```bash

cd backend

npm install

npx prisma migrate dev

node seed.js

npm run start:dev

```



Backend: `http://localhost:3000`



\## Run Frontend



Open another terminal:



```bash

cd frontend

npm install

npm start

```



Frontend: `http://localhost:4200`



\## Run Tests



Inside the backend folder:



```bash

npm test

```



The project includes 24 Jest tests.



\## Demo Login Credentials



All seeded users use the password:



`Pass@123`



\- Admin: `admin@test.com`

\- Manager: `manager1@test.com`

\- Manager: `manager2@test.com`

\- Employees: `employee1@test.com` to `employee8@test.com`



\## Roles and Permissions



\- Employees can submit, view and cancel their own leave requests.

\- Managers can review leave requests from their assigned team.

\- Admins can manage system settings and review all leave requests.



\## Security



\- Passwords are hashed.

\- JWT authentication protects API routes.

\- Role-based authorization is enforced on the server.

\- Environment secrets must remain private.

