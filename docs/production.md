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
| `PHONE_VERIFICATION_ENABLED` | `true` / `false` — vote OTP gate (SMS vendor still unset in prod) |
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

On first connection the process applies idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` / index creation, team catalog sync, pinned starter topics (skip if title exists), vote revoke/backfill, and **production demo-seed strip**. Failed boot closes the connection and does not keep a half-open singleton. Production also refuses to serve if `PRAGMA quick_check` is not `ok`.

Team `is_forum_active` is reset from code on each boot (the 25 active tribunes). That is idempotent; it does not delete forum posts.

## SMS

`PHONE_VERIFICATION_ENABLED=true` enforces phone OTP for votes. Production has no SMS vendor wired: OTP send fails closed until a provider is configured. Do not use the dev `data/last-otp.txt` inbox in production.

## Trusted proxy

Leave `TRUST_PROXY=none` unless the process sits behind a proxy you control. Forged `X-Forwarded-For` is ignored unless you opt in.
