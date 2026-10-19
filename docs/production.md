# Production deployment (SQLite)

This app uses a single SQLite file (WAL mode) via `better-sqlite3`. It is **not** bound to a specific cloud vendor. It **does** require a persistent disk: do not run production on an ephemeral container filesystem without a mounted volume.

## Persistent disk

- Store the database on durable storage (block volume, bind mount, etc.).
- Set `BIZIM_TRIBUN_DB` to an **absolute** path on that volume, for example `/var/lib/bizim-tribun/bizim-tribun.db`.
- The parent directory must already exist. Production will not create a database under `/tmp` or `os.tmpdir()`.
- Do not use `:memory:` in production.
- Relative paths are rejected in production so a changing process cwd cannot silently open the wrong file.

## Environment

Copy `.env.example` and set at least:

| Variable | Production |
| --- | --- |
| `NODE_ENV` | `production` |
| `BIZIM_TRIBUN_DB` | Absolute path to the SQLite file on persistent disk |
| `APP_SECRET` | ≥ 32 random characters (session HMAC) |
| `APP_URL` | Public HTTPS origin, no trailing slash |
| `TRUST_PROXY` | `none` (default), `forwarded` (nginx), or `cloudflare` |
| `TRUST_PROXY_HOPS` | Hop count when `TRUST_PROXY=forwarded` (usually `1`) |
| `RESEND_API_KEY` | Required to send mail |
| `MAIL_FROM` | From address Resend accepts |
| `SMS_PROVIDER` | `netgsm` or `twilio` (plus that provider's credentials). Unset = SMS sign-up/login closed (503) |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Bot check before every SMS send. Required in production (fails closed) |
| `DB_BACKUP_DIR` | Optional backup directory (default: `<db-dir>/backups`) |
| `DB_BACKUP_RETENTION` | Optional; default `7` daily files |

Never commit secrets. Do not put API keys or `APP_SECRET` in source control.

`BOOTSTRAP_ADMIN_*` is ignored when `NODE_ENV=production`.

## Build and run

Stop any previous `next start` before restore.

```bash
npm ci
npx tsc --noEmit --incremental false
npm run build
NODE_ENV=production BIZIM_TRIBUN_DB=/absolute/path/bizim-tribun.db npm start
```

`next build` does not open the production database. `next start` does: `BIZIM_TRIBUN_DB` must be set.

Health (no PII, no paths): `GET /api/health` → `{ "ok": true, "db": "healthy" }`. Load balancers can poll this. `/api/` is disallowed in robots.txt.

## Backup

SQLite is in WAL mode. Do **not** `cp` the live `.db` while the app is writing. Use the online snapshot:

```bash
NODE_ENV=production BIZIM_TRIBUN_DB=/absolute/path/bizim-tribun.db npm run db:backup
```

This uses `VACUUM INTO` (consistent copy, WAL-aware), then `PRAGMA integrity_check` on the copy, then deletes older files beyond `DB_BACKUP_RETENTION`.

Schedule daily (cron/systemd timer), **or** stop the app and run the same command.

Logs only print `backup ok <filename>` or `backup failed` — no secrets, tokens, or full filesystem paths.

## Restore

1. Stop the app (`next start` / process supervisor) so nothing is writing.
2. Keep `BIZIM_TRIBUN_DB` pointing at the live file.
3. Run:

```bash
NODE_ENV=production BIZIM_TRIBUN_DB=/absolute/path/bizim-tribun.db \
  npm run db:restore -- /absolute/path/to/bizim-tribun-YYYYMMDDTHHMMSSZ.sqlite
```

Restore snapshots the current live file into `<db-dir>/restore-safety/` first, copies the backup with `VACUUM INTO`, runs `PRAGMA integrity_check`, then replaces the live file (including leftover `-wal` / `-shm`). Start the app only after `restore ok`.

## Boot / migrations

On first connection the process applies the idempotent baseline (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN`), then the ordered run-once migrations in `src/lib/migrations.ts` (recorded in `schema_migrations`), team catalog sync, pinned starter topics (skip if title exists), and removal of leftover demo ballots from old dev builds. **Take a backup (`npm run db:backup`) before deploying a build that adds a migration.** See [data-policy.md](data-policy.md). Failed boot closes the connection and does not keep a half-open singleton. Production also refuses to serve if `PRAGMA quick_check` is not `ok`.

Team `is_forum_active` is reset from code on each boot (the 25 active tribunes). That is idempotent; it does not delete forum posts.

## SMS

Sign-up and sign-in are by SMS code. Set `SMS_PROVIDER` and that provider's credentials (see `.env.example`). Without them production answers 503 to code requests and creates no codes. `SMS_PROVIDER=dev` is refused in production. The Netgsm and Twilio adapters are written against their public APIs but **have not been tested with a live account**; send one real code to your own phone before opening sign-ups.

## First super admin

There is no admin sign-up and no default admin. See [admin-bootstrap.md](admin-bootstrap.md).

## Trusted proxy

Leave `TRUST_PROXY=none` unless the process sits behind a proxy you control. Forged `X-Forwarded-For` is ignored unless you opt in.
