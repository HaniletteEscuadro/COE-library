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
| `STORAGE_MAX_BYTES` | e.g. `100GB` | ceiling the app enforces — match it to the volume |
| `NEXTAUTH_URL` | `https://<your-app>.up.railway.app` | session cookies and the Socket.IO CORS origin |
| `NEXTAUTH_SECRET` | a long random string | signs the session JWTs |
| `NODE_ENV` | `production` | |

### How big can the library get?

Two different numbers, and only one of them is in this repository.

**The volume** is the real disk. Its size is set in Railway → the service →
**Settings → Volumes**, it can be resized later, and it is what you are billed
for. Railway's per-plan volume ceiling changes; check the current limit on your
plan before promising anyone 100 GB.

**`STORAGE_MAX_BYTES`** is a ceiling this app refuses to cross, so that a full
library says so in a sentence instead of failing halfway through a write. It
creates no space. Set it to the volume's size.

Get them the wrong way round and the failure is confusing rather than
dangerous: with a 100 GB ceiling on a 5 GB volume, uploads break at 5 GB while
the error quotes 100 GB. The server prints a warning at boot when it can read
the volume's real size and the two disagree.

### Per-file size, and why it is not 100 GB

`MAX_UPLOAD_FILE_MB` defaults to 250. That is a **memory** limit, not a disk
one: the upload route reads each file into a Buffer to check its magic bytes
and hash it, and Next has already materialised its own copy in `formData()`,
so one upload peaks at roughly twice the file size in RAM.

Raising it to a gigabyte does not give you gigabyte uploads — it gives you a
container killed for running out of memory partway through one, which looks
from the outside like the site restarting at random. Raise the container's
memory first; budget about 3x the per-file limit.

A library of 100 GB made of 250 MB files is fine. A single 4 GB video is not,
and needs the upload route to stream to disk rather than buffer — a rewrite of
the multipart handling, not a bigger number here.

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
| a data path is not under the volume Railway says is mounted, or shares a filesystem with the app | the volume is named but not mounted there, so the accounts are erased on the next deploy |
| the database is empty where it previously held accounts | it is a different database than last boot — restore before anyone registers into this one |

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

### The volume has to be mounted, not just named

The check above proves the path is *outside* the app. It does not prove
anything is mounted at it — and there is a third case between "inside the app"
and "nothing is there at all": `/var/data` exists, because something created it
on the container's own disk when the volume's Mount Path was set elsewhere, or
when the volume was detached and the variables left behind. Every earlier check
passes. SQLite writes there, migrations apply, the health check goes green, and
the deploy that erases every account looks exactly like the one that does not.

Two things tell them apart. Railway names the volume's real mount point in the
environment, so when a data path is not under it the platform has already said
which value is wrong:

```
  DATABASE_URL points at /srv, which is not on the
    volume. The volume attached to this service is mounted at
    "/var/data", so that directory is the container's own disk.
    Every account is erased on the next deploy. Set:
      DATABASE_URL=file:/var/data/coe.db
      STORAGE_DIR=/var/data/storage
```

Where nothing names a mount point, the filesystems are compared instead: a
mounted volume is a different device from the container image, a directory the
app created is the same one. That is fatal on Railway, Render and Fly, where the
application directory is rebuilt on every deploy by definition. On a VPS it
prints as a warning and the server starts, because one filesystem for everything
is normal there and perfectly durable.

### And it has to be the *same* volume as last time

The last way to lose the accounts leaves the volume mounted and every path
correct: `DATABASE_URL` gets edited, or the volume is remounted onto another
service, and the file behind it is a different, emptier database.

`> data: 0 accounts` already prints on every boot, with a note that an empty
database is expected on a brand-new volume and alarming otherwise. Which of
those it is was left to whoever read the log. Now it is checked: a marker file
beside the database (`.coe-storage.json`) records the highest account count ever
seen there, and if that is above zero and the database now holds none, the
server refuses to start.

```
  Cannot start:
  The database at this path is empty, but it previously held 42 accounts:

      /var/data/coe.db

  Something replaced the database instead of reusing it. Check whether
  DATABASE_URL changed, whether this is the same volume as last deploy,
  and restore the newest file from the backups directory before any
  traffic reaches this instance.
```

Refusing is the point. A server that starts on the empty database collects
registrations into it, and merging those rows back into the restored database
afterwards is far harder than the ten minutes a restore costs.

---

## Backups

Accounts are permanent by design: registration writes a row that nothing
expires, and the admin panel's delete is a soft delete. The remaining risks are
the ones no boot check can see — a mistaken hard-delete, a bad migration,
corruption after an unclean shutdown.

So the server copies the database at boot and then every
`DB_BACKUP_INTERVAL_HOURS` (default 24) into `<STORAGE_DIR>/backups`, keeping
the newest `DB_BACKUP_KEEP` (default 14) and deleting the rest — a full volume
would itself stop new accounts being created, which is the outcome the backups
exist to prevent. The copy goes through SQLite's online backup API rather than
`cp`, so a write landing mid-copy produces a consistent file instead of an
unopenable one.

The first copy is taken at boot rather than a day later, so every deploy leaves
behind the state it started from — which is what you want when a migration in
that same deploy turns out to be wrong.

Take one by hand before anything risky:

```bash
npm run db:backup
```

To restore: stop the service, copy the chosen file over the one at
`DATABASE_URL`, start it again.

**These backups sit on the same volume as the database.** They cover the slow
losses, not the loss of the volume itself — the checks above are what covers
that. If the accounts matter, open a shell on the service (`railway ssh`), find
the newest file in `/var/data/storage/backups`, and copy it somewhere that is
not this host.

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
