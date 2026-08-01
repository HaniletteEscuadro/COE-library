# Aster ID Education Platform

Modern student management, library management, authentication, and operations platform built with Next.js, TypeScript, Tailwind CSS, NextAuth, Prisma, and PostgreSQL.

## Core Modules

- Secure authentication: credentials, optional Google OAuth, email verification, password reset, tracked active sessions, login history, CSRF checks, and rate-limited login attempts.
- Role-based access: `ADMIN`, `REGISTRAR`, `FACULTY`, `LIBRARIAN`, `STUDENT`, and baseline `USER`.
- Admin dashboard: institution metrics, people overview, active sessions, student/faculty profile coverage, library risk, and audit activity.
- Student portal: student identity, program, enrollments, attendance, grades, and borrower activity.
- Academic operations: departments, programs, courses, course sections, faculty assignment, capacity, and enrollment status.
- Library system: catalog titles, physical copies, active loans, holds, overdue risk, and borrower history.
- Audit logging: platform-level audit schema and service for operational events, status changes, imports, exports, and access decisions.
- Responsive app shell: protected navigation adapts by role and remains usable on mobile.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/auth_system?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

3. Generate Prisma Client and migrate the database:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Optional starter data:

```bash
npm run prisma:seed
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000/auth/login`.

## Production Notes

- Use a strong `NEXTAUTH_SECRET` and HTTPS in production.
- Keep Prisma migrations under version control after running `npm run prisma:migrate`.
- Configure real email delivery for verification and password reset links. Development APIs may return generated links for local testing.
- Assign roles deliberately. UI navigation is role-aware, and protected pages also enforce server-side role checks.
- The app sends baseline hardening headers from `next.config.ts`. Add a nonce-based Content Security Policy only after wiring nonce support through Next/Auth pages.
- Audit logging is available through `src/lib/audit.ts`; call it from future mutation APIs and server actions.
