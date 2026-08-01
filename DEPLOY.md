# Publishing the site

## Read this first: Netlify cannot run this app

This is not a configuration problem — it is what Netlify is. Three parts of the
system need something serverless hosting does not provide:

| Feature | Why it fails on Netlify |
|---|---|
| **Live admin dashboard** | Socket.IO holds an open WebSocket per client. Netlify Functions are stateless and shut down between requests, so there is nothing to hold the connection. |
| **Accounts & materials** | SQLite is a file. Netlify's filesystem is read-only at runtime and wiped on every deploy — every account would disappear. |
| **Uploaded files** | Same. Files written to disk would not survive a single deploy. |

Your requirement *"appears instantly in the admin panel without refreshing"*
therefore cannot be met on Netlify without replacing all three pieces with paid
services (Neon + Netlify Blobs + Pusher).

**Render is used instead.** It runs a normal Node process with a persistent
disk, so everything already built works unchanged.

---

## Deploy to Render

### 1. Push the code to GitHub

Build first. The build copies the student portal into `auth-system/portal/`,
and that copy is what the deployed site serves — the originals live one folder
up and are not part of this repository.

```bash
cd auth-system
npm run build
git init
git add .
git commit -m "COE Studio"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> `.gitignore` excludes `.env`, `node_modules`, `storage/`, every `*.db` file
> and any `backup-*/` folder, so no secrets, uploads or copies of the database
> are committed. `portal/` **is** committed on purpose — see below.

Check what you are about to publish before the first push:

```bash
npm run preflight
```

It fails if `.env`, a `*.db` file or a `backup-*/` folder is tracked, if
`portal/` is missing or untracked, or if `portal/` is older than the front-end
files it was copied from.

**After editing the front-end, re-run `npm run build` and commit `portal/`.**
Otherwise the change never reaches the deployed site — `preflight` catches this.

### 2. Create the service

1. Go to <https://dashboard.render.com> → **New** → **Blueprint**
2. Connect the repository. Render reads [`render.yaml`](./render.yaml) and
   configures everything automatically.
3. Before the first deploy, set the two secret values it asks for:

   | Variable | Value |
   |---|---|
   | `SEED_ADMIN_EMAIL` | your admin email |
   | `SEED_ADMIN_PASSWORD` | a strong password, 12+ characters |

4. Click **Apply**.

The first deploy runs the migration and seeds the admin account plus the
310-folder curriculum tree.

### 3. Sign in

Open the URL Render gives you (`https://coe-studio.onrender.com`) and sign in
with the admin credentials from step 3.

---

## Why the `starter` plan

Render's free tier has **no persistent disk**. On free, `/var/data` does not
survive a restart, so the database and every uploaded file would be lost. The
`disk` block in `render.yaml` requires `starter`.

If you must stay on free, move the database to a hosted provider instead:

```yaml
- key: DATABASE_URL
  value: <your Neon or Turso connection string>
```

Uploads would still not persist, so file storage would need to move to
Cloudinary or S3 as well.

---

## After deploying

**Change the admin password** on first login.

**Confirm real-time works** — open `/admin` in one browser, register a new
account in another (or on your phone). The new row should appear in the table
immediately, highlighted, with no refresh. If it does not, the WebSocket is
being blocked; check the browser console for `socket` errors.

**`NEXTAUTH_URL` must exactly match** the address people actually visit,
including `https://`. A mismatch makes sign-in redirect to the wrong host and
fail silently.

---

## Alternative hosts

Anything that runs a persistent Node process with a mounted volume works with
no code changes:

| Host | Notes |
|---|---|
| **Railway** | Add a volume, set `DATABASE_URL` and `STORAGE_DIR` to point into it |
| **Fly.io** | `fly volumes create`, then mount at `/var/data` |
| **VPS** (DigitalOcean, Hetzner) | `npm ci && npm run build`, then run `npx tsx server.ts` behind nginx |

The build and start commands are the same everywhere:

```bash
npm ci && npx prisma generate && npm run build
npx prisma migrate deploy
npx tsx server.ts
```

---

## Verified before writing this

Run against a production build (`NODE_ENV=production`, `npx tsx server.ts`):

```
next build                          exit 0, 0 warnings (39 routes)
tsc --noEmit                        exit 0
eslint                              exit 0, 0 problems
production server                   Ready, Socket.IO listening

/api/health                         200  {"status":"ok","database":"reachable"}
/auth/login                         200
/api/csrf                           200
/portal/index.html                  200  (served from the bundled copy)
/portal/scripts.js                  200
/portal/assets/coe-engineering.jpg  200
/admin        (anonymous)           307 -> /auth/login?callbackUrl=%2Fadmin
/dashboard    (anonymous)           307 -> /auth/login
/api/admin/users (anonymous)        401

Path traversal, all 404:
/portal/auth-system/.env
/portal/auth-system/dev.db
/portal/auth-system/prisma/schema.prisma
/portal/..%2f..%2fpackage.json
/portal/SETUP.md                    (extension not in the allowlist)

Response headers on every route:
  Content-Security-Policy       default-src 'self'; object-src 'none'; base-uri 'self'; …
  Strict-Transport-Security     max-age=63072000; includeSubDomains  (production only)
  X-Frame-Options               DENY  (SAMEORIGIN on /api/library/preview only)
  X-Content-Type-Options        nosniff
  Referrer-Policy               strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy    same-origin
  Permissions-Policy            camera=(), microphone=(), geolocation=(), …

Auth and access control, end to end:
  register without x-csrf-token       403
  register with x-csrf-token          201
  register asking for role=ADMIN      201, role assigned STUDENT
  sign in as that student             200, session issued
  student -> /api/admin/users         403
  student -> /api/admin/logs          403
  student -> /admin                   307 -> /auth/login
  student -> PATCH own role to ADMIN  403
  registration rate limit             trips at 40 sign-ups per IP per hour

Production boot guards, each attempted with a deliberately bad config:
  NEXTAUTH_SECRET = the dev value      refused to start
  NEXTAUTH_SECRET = 8 characters       refused to start
  DATABASE_URL inside the app dir      refused to start
  STORAGE_DIR unset                    refused to start
  ALLOW_EPHEMERAL_STORAGE=true         booted, with the data-loss warning
```

The accounts and log rows those checks created were deleted afterwards.
