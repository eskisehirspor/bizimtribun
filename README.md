# Bizim Tribün

Türkiye'nin il bazında taraftar sayımı ve taraftar forumu. Next.js 16 + SQLite (`better-sqlite3`).

- Accounts are created and signed in with an SMS code; each account casts one permanent team vote.
- Production: [docs/production.md](docs/production.md) · Data rules: [docs/data-policy.md](docs/data-policy.md) · First admin: [docs/admin-bootstrap.md](docs/admin-bootstrap.md)

## Local development

```bash
npm ci
cp .env.example .env.local   # SMS_PROVIDER=dev shows the code on screen, sends no SMS
npm run dev
```

## Checks

```bash
npm test                      # unit + HTTP integration tests (temporary SQLite files)
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```
