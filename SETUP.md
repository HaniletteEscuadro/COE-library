# Setup

**Steps 1–4 have already been completed on this machine.** Node.js 24.18.1 is
installed, dependencies are installed, the database exists at `prisma/dev.db`,
and it has been seeded. Skip to [Start the app](#5-start-the-app).

They are kept here for setting the project up somewhere else.

Everything below is run from the `auth-system` folder in **PowerShell**.

```powershell
cd "c:\Users\Admin\Desktop\GAMITKO\Website COE PROJECT BACKUP\COE PROJECT\auth-system"
```

---

## 1. Install Node.js — done

```powershell
winget install OpenJS.NodeJS.LTS
```

If `winget` is unavailable, download the **LTS** installer from
<https://nodejs.org/> and run it.

**Close and reopen PowerShell afterwards** — the installer edits PATH, and an
already-open terminal keeps the old copy. Then verify:

```powershell
node -v    # v24.18.1 here
npm -v     # 11.16.0 here
```

---

## 2. Install dependencies — done

The `node_modules` that shipped with this backup was damaged: 322 of its 398
package folders were empty, including `next` itself. It could not be repaired in
place, because `npm install` will not refill a folder it believes already
exists. It was deleted and reinstalled from scratch:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
```

A handful of `npm warn` lines is normal; `npm error` is not.

---

## 3. Create the database — done

The project uses **SQLite** — there is no database server to install. The whole
database is one file at `prisma/dev.db`:

```powershell
npm run prisma:generate
npm run prisma:migrate -- --name init
```

> Prisma 7 note: the `datasource` block no longer accepts `url`. The connection
> string reaches Migrate through `prisma.config.ts`, and the runtime client
> through the `PrismaBetterSqlite3` driver adapter in `src/lib/prisma.ts`.
> Also, `prisma migrate dev` no longer supports `--skip-generate`.

---

## 4. Create the first admin account — done

```powershell
npm run prisma:seed
```

This also builds the library folder tree: 310 folders covering
2 courses × 4 years × 41 subjects × 5 material categories.

Credentials come from `.env` (`SEED_ADMIN_*`) — read them from there, they are
deliberately not repeated in this file. `.env` is gitignored; this file is not,
so a password written here would be published the moment the repository is
pushed.

**Change the password after your first login.** The seed refuses to run with a
blank or short password rather than falling back to a guessable default.

Re-running the seed is safe — it will not reset a password you have changed.

---

## 5. Start the app

```powershell
npm run dev
```

Open <http://localhost:3000>.

> Use `npm run dev`, **not** `npm run dev:next`. The plain Next dev server does
> not start Socket.IO, so the admin dashboard would fall back to polling
> instead of updating live.

---

## Troubleshooting

**`npm : The term 'npm' is not recognized`**
Node isn't installed, or you didn't reopen PowerShell after installing it.

**`Environment variable not found: DATABASE_URL`**
`.env` is missing. Copy `.env.example` to `.env` and fill it in.

**`Error: P1012` / schema validation errors**
Run `npm run prisma:generate` again — the generated client is out of date
relative to `prisma/schema.prisma`.

**Login says "Verify your email before signing in"**
Set `REQUIRE_EMAIL_VERIFICATION="false"` in `.env`. Verification links are
generated but not delivered until SMTP is configured, so leaving this on locks
out every new account.

**Port 3000 already in use**

```powershell
$env:PORT = "3001"; npm run dev
```

Also update `NEXTAUTH_URL` in `.env` to match, or sign-in callbacks will fail.

**Start over from an empty database**

```powershell
npm run db:reset
npm run prisma:seed
```

---

## What changed from the original setup

| Before | Now | Why |
|---|---|---|
| PostgreSQL | SQLite | No database server to install or run |
| Prisma `enum` types | `String` + `src/lib/enums.ts` | Prisma's SQLite connector has no enum support |
| `String[]`, `Json` columns | JSON-encoded `String` | Neither is supported on SQLite |
| `@prisma/adapter-pg`, `pg` | removed | Postgres-only driver packages |

The original PostgreSQL schema is preserved at
`prisma/schema.postgres.prisma.bak` if you ever move to a hosted database.
