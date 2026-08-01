# Deploying COE Studio to Railway

The app is a **custom Node server** (`server.ts`), not a plain Next.js app —
Socket.IO shares the HTTP listener, so the standard "Next.js on Vercel" path
does not apply. It needs one Railway service running a long-lived process.

---

## The one thing that will lose your data if you skip it

Railway gives every deploy a **fresh, empty filesystem**. This app keeps two
things on disk:

- the SQLite database (`dev.db`)
- every uploaded file (`storage/`)

Without a volume, **both are wiped on every deploy and every restart** — every
account, every material, every question. The site keeps working, so nobody
notices until they look for something that is gone.

So: attach a volume first, then point both at it.

### Attach the volume

In the service → **Settings → Volumes → Add volume**, mount path:

```
/var/data
```

> **`/var/data`, the same path `render.yaml` uses.**
>
> This used to say `/data` while `render.yaml` said `/var/data`, and that one
> inconsistency cost an afternoon of failed deploys: the Render value was
> copied onto Railway's volume while `DATABASE_URL` was left at `/data`. The
> volume mounted fine, `prisma migrate deploy` created `/data` on the
> container's own disk, reported **"All migrations have been successfully
> applied"**, and then the container was replaced and that directory went with
> it. Every request afterwards failed with `Cannot open database because the
> directory does not exist`, and the only symptom was a health check timing out.
>
> One path for both hosts now. The rule that matters either way: the volume's
> **Mount Path** and the two variables below must name the *same* directory.
> The server refuses to start when they disagree, and prints the volume's real
> location so the fix is in the message.

### Then set these variables

Service → **Variables**:

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | `file:/var/data/coe.db` | database on the volume, not the container |
| `STORAGE_DIR` | `/var/data/storage` | uploads on the volume |
| `NEXTAUTH_URL` | `https://<your-app>.up.railway.app` | session cookies and the Socket.IO CORS origin |
| `NEXTAUTH_SECRET` | a long random string | signs the session JWTs |
| `NODE_ENV` | `production` | |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`PORT` is injected by Railway. Do **not** set it, and do not set `HOST` —
the server binds `0.0.0.0` in production on its own.

> **`NEXTAUTH_URL` is a chicken-and-egg.** You do not know the domain until the
> first deploy. Deploy once, copy the generated domain from Settings → Networking,
> set the variable, and redeploy. The first deploy will boot but refuse to start
> — that is deliberate; see "Why it refuses to start" below.

### Do not reuse the development secret

`.env` in this folder holds a `NEXTAUTH_SECRET` and a `SEED_ADMIN_PASSWORD` that
were generated for local use. Both must be replaced with fresh values in
Railway's variables — a shared secret means anyone with a copy of this folder
can forge a session token for the live site.

`.env` is gitignored, so it is not pushed. Set the production values in the
Railway dashboard only.

### Seed the first admin

The database starts empty, so there is no way in. Either set these before the
first boot and run the seed once from the Railway shell:

```
SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
```

```bash
npm run prisma:seed
```

…or create the account locally and copy `dev.db` onto the volume.

---

## The student portal ships inside the app

The portal front-end (`index.html`, `scripts.js`, `styles.css`, …) lives one
folder *above* `auth-system/`, and the `/portal/*` route serves it from there
during development so the files stay editable in place.

That directory is not part of the deployment — the repository is initialised
inside `auth-system/`, so Railway only ever receives this folder. Serving from
the parent in production would 404 every request for the student-facing site.

`npm run build` therefore copies the portal into `auth-system/portal/` first
(`scripts/bundle-portal.mjs`), and **that directory is committed**. The route
prefers the parent when it exists and falls back to this copy when it does not,
so development is unchanged and production works.

Two consequences worth knowing:

- **Re-run `npm run build` and commit `portal/` after editing the front-end.**
  A change to `scripts.js` that is not rebuilt reaches nobody. The build does
  this automatically; the commit does not.
- The server prints which copy it is using at startup:

  ```
  [portal] serving from /app/portal
  ```

  If `/portal/*` 404s, that line says why.

---

## What runs, and when

Railway's Nixpacks builder picks these up from `package.json` automatically:

| Phase | Command | What it does |
|---|---|---|
| build | `npm run build` | `bundle-portal && prisma generate && next build` |
| start | `npm start` | `prisma migrate deploy && tsx server.ts` |

Migrations run at **start**, not at build: the build container has no volume
mounted, so a migration there would be written to a disk that is thrown away.

`prisma` and `dotenv` are in `dependencies` rather than `devDependencies` on
purpose — both are needed *at runtime* (the CLI for `migrate deploy` on every
boot, dotenv because `server.ts` imports it). With them under `devDependencies`
a production install that prunes dev packages would crash on boot.

---

## Health check

`GET /api/health` returns 200 only when the database actually answers a query.

A check that only proves the process is listening would mark a deploy healthy
while every request failed — container up, volume not mounted. This one returns
503 in that case, so Railway holds traffic back and retries.

---

## Why it refuses to start

`server.ts` checks five things on boot in production and exits rather than
serving a deployment that is quietly broken. Every one of these fails
*silently* otherwise:

| Refuses when | Because |
|---|---|
| `NEXTAUTH_SECRET` missing | NextAuth cannot verify tokens it issued before the last restart, so everyone is signed out on every deploy |
| `NEXTAUTH_SECRET` is the development value | anyone holding a copy of this folder can forge a signed session for any account, administrators included |
| `NEXTAUTH_SECRET` shorter than 32 chars | it signs every session token; a short one is brute-forceable |
| `NEXTAUTH_URL` missing or has no scheme | the Socket.IO CORS origin falls back to the bind address, `0.0.0.0`, which matches no browser — live updates stop and nothing says why |
| `DATABASE_URL` or `STORAGE_DIR` points inside the app directory | **the deploy would erase every account and every uploaded file** — see below |

A deploy that will not boot is easier to diagnose than one that boots broken.

### The data-loss check

This is the one worth understanding. Nothing about losing the volume *looks*
like a failure: the container starts, the health check passes, the login page
renders. The database is simply empty again, and it is usually noticed days
later by a student who cannot find their account — at which point nothing can
be recovered, because the data was never anywhere else.

So the server refuses to start if the SQLite file or the uploads directory
would land on the container's own disk instead of the mounted volume:

```
  Cannot start: this deployment would lose all of its data.

    DATABASE_URL points inside the app directory:
        file:./dev.db  ->  /app/dev.db
      Every account is erased on the next deploy. Put it on the volume:
        Railway   DATABASE_URL=file:/var/data/coe.db
        Render    DATABASE_URL=file:/var/data/coe.db
```

For a throwaway preview where losing everything is genuinely the intent, set
`ALLOW_EPHEMERAL_STORAGE=true`. It boots, and prints a warning on every start.
Never set it on the deployment students actually use.

---

## Before you push

```bash
npm run preflight
```

Checks the things that are invisible until it is too late: that `portal/` is
present, tracked, and not older than the front-end it was copied from; and that
git is not about to publish `.env`, a `*.db` file, or a `backup-*/` folder.
Exits non-zero if anything is wrong.

```bash
npm run gen:secret
```

Prints a fresh `NEXTAUTH_SECRET`. Paste it into the host's variables — never
into a committed file.

---

## After it is up

The student portal is at:

```
https://<your-app>.up.railway.app/portal/index.html
```

Not the site root — that is the Next.js auth app. The portal is served from the
same origin on purpose, so the session cookie and the socket both work.

---

## Scaling past one container

Two limits are worth knowing before you outgrow them:

- **SQLite has one writer.** Fine for a college department; it will not survive
  being split across replicas. `numReplicas` is pinned to 1 in `railway.json`
  for that reason — a second replica would open the same file twice.
- **Socket.IO holds connections in memory.** Two replicas would each know only
  their own half of the users, so a live update would reach some and not others.
  Moving past one replica needs a Redis adapter and Postgres, in that order.
