# First super admin

There is no admin sign-up, no default admin and no known password.

1. Deploy, configure SMS + Turnstile, and sign up normally at `/uye-ol` with your own phone.
2. On the server (shell access is the authorization), with the same env as the app:

   ```bash
   NODE_ENV=production BIZIM_TRIBUN_DB=/absolute/path/bizim-tribun.db \
     npm run admin:bootstrap -- <username>
   ```

3. Sign in again and enable TOTP 2FA at `/admin/guvenlik`. 2FA is mandatory for every
   staff role: until it is on, the panel shows only that page and every other admin API
   answers 403.
4. Promote moderators and admins from `/admin/uyeler/<id>` (super admin only). See
   [admin.md](admin.md) for what each role can do.

Without shell access (for example a cPanel Node.js app), set `SUPER_ADMIN_EMAIL` in the
app's environment instead. While no super admin exists, the account that has verified
that e-mail with a code becomes super admin the next time a session is created for it
(sign-up or sign-in), with a `super_admin_bootstrap` audit entry. It does nothing once a
super admin exists, so it can stay set. 2FA is still forced as in step 3.

The command refuses if a super admin already exists, if the account does not exist,
is deleted or banned, or has not verified its phone. It revokes the account's sessions
and writes a `super_admin_bootstrap` entry to `audit_log`. Further admins are promoted
from the admin panel, which is also audited.

`BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_EMAIL` still exist for local development
only and are ignored when `NODE_ENV=production`.
