# Cloudflare deploy

The site runs as one Cloudflare Worker (OpenNext) and talks to Supabase
Postgres through Hyperdrive. Live vote updates go over Supabase Realtime.

## Database

`supabase/schema.sql` holds every table, guard trigger and the RLS switch;
`npm run db:sql` writes `supabase/setup.sql` (schema plus starting rows).
Both are safe to run again.

The Worker logs in as `bizimtribun_app`, a role that can read and write the
`public` tables and nothing else (it bypasses RLS; the public API keys see no
rows). Its password is only ever set from the deploy machine:

```sql
ALTER ROLE bizimtribun_app WITH PASSWORD '<random>';
```

Connection string for Hyperdrive (session pooler, port 5432):

```
postgresql://bizimtribun_app.cqxkjbrvfqpizbpmtrns:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

## First deploy

```sh
npx wrangler login
npx wrangler hyperdrive create bizimtribun-db --connection-string="<above>"   # done, id is in wrangler.jsonc
echo "NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>" > .env.production.local
npm run cf:deploy
printf %s "<value>" | npx wrangler secret put APP_SECRET   # 48 random bytes
# same for RESEND_API_KEY, TURNSTILE_SECRET_KEY, SUPER_ADMIN_EMAIL
```

Public settings live in `wrangler.jsonc` (`vars`) and `.env.production`.

## Custom domain

Add `bizimtribun.com` and `www.bizimtribun.com` as Worker custom domains
(`routes` with `"custom_domain": true`). Cloudflare replaces the old A record
for the apex; the Resend, SPF and DMARC records stay as they are. Then
remove `MAIL_LINK_URL` from `wrangler.jsonc` so mail links use `APP_URL`.

The free Workers plan allows 10 ms CPU per request. If requests start failing
with CPU limit errors, the $5/month Workers Paid plan lifts it to 30 s.
