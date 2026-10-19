# Accounts, census and data policy

## Identity

- One account = one row in `users`. New accounts are created only after an SMS code proves
  the phone (`/api/auth/otp/request` → `/api/auth/otp/verify` → `/api/auth/signup`).
- A phone number can be *verified* on at most one non-deleted account
  (`idx_users_phone_norm` unique index + checks in `accounts.ts`).
- Older password accounts keep working. To vote or post they verify a phone once
  (`/api/account/phone/*`). If a newer account verifies a number that an older account only
  *typed* (never verified), the verified owner keeps it and the older claim is cleared.
- SMS verification proves control of a phone number at a point in time. It does not prove
  that one real person stands behind one account, and nothing in the product claims that.
- Codes: 6 digits, 5 minutes, 5 wrong tries, stored only as salted HMACs, never logged or
  returned (except by the dev provider outside production).
- Limits: per IP 10 sends/hour, per phone 3/hour and 8/day, 60 s resend cooldown, per IP 30
  and per phone 10 code checks/hour, 5 sign-ups per IP/hour. Turnstile before every send.

## Census

- `fan_votes`: one row per account (`user_id UNIQUE`), team and city immutable (trigger),
  never deleted (trigger), insert only for phone-verified, non-deleted accounts and active
  teams (trigger). Account + vote are created in one transaction, so a failed vote leaves no
  half-registered account.
- **"Doğrulanmış taraftar"** = `COUNT(*) FROM fan_votes WHERE status = 'active'`.
  Team, province and national rankings all use the same rows.
- A province's leader is the team with the most active votes there. Equal top counts are
  shown as a tie (`tied: true`, `coLeaderIds`); provinces without votes are neutral.
- Votes without a province count nationally only. The province on a vote is the one the user
  chose when voting; it is never inferred from GPS or IP.
- Deactivating a team stops new votes for it; its existing votes still count. Teams with votes
  or forum topics cannot be deleted (trigger).
- Data correction: `voidFanVote` sets `status = 'void'` with a reason and writes `audit_log`.
  It never changes the team and a voided vote cannot be re-activated. There is no "move vote"
  operation anywhere.

## Account deletion

`POST /api/account/delete` (typed confirmation) does, in one transaction:

- voids the vote (`void_reason = 'account_deleted'`), so every count drops by one;
- erases phone, e-mail, names, birth date, city, password and 2FA secrets; the username
  becomes `silinmis_<id>`, display name "Silinmiş üye"; sessions are revoked;
- keeps forum posts, shown under "Silinmiş üye";
- stores a keyed HMAC of the phone in `phone_holds` for **30 days** (`PHONE_HOLD_MS`) so the
  same number cannot immediately re-register and vote again. After that it is deleted and the
  number can open a new account whose vote counts once. This is disclosed in the KVKK text.

Admin accounts must be demoted before deletion.

## Old e-mail census ("mühür")

The earlier `participants` / `votes` tables (e-mail link, optional phone OTP, not tied to an
account) are **closed and not counted**. Their rows are kept untouched for the record and the
admin dashboard shows their number separately as "legacy". Their endpoints answer `410`.
Old participants can still erase their data via `/sil-verilerim`; that now also drops the
e-mail/phone HMACs instead of keeping them forever. Fake demo ballots from old development
builds are removed at boot; nothing seeds fans or votes any more.

## Retention

| Data | Kept |
| --- | --- |
| Account data | while the account exists |
| `auth_otps`, rate-limit counters | ≤ 2 days |
| `signup_tickets` | 15 minutes (purged after expiry) |
| `phone_holds` | 30 days after deletion |
| `audit_log`, `security_events` | append-only; no OTPs, passwords or phone numbers |
