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
- clears bio, avatar and profile choices, and deletes the member's badges and notifications;
- keeps forum posts, shown under "Silinmiş üye";
- stores a keyed HMAC of the phone (never the number) in `phone_holds` so the same number
  cannot re-register and vote again right away:
  - **30 days** for an account that never voted (`PHONE_HOLD_MS`);
  - **1 year** for an account that cast a vote (`PHONE_HOLD_VOTED_MS`);
  - **no end date** for an account deleted while banned (`PHONE_HOLD_PERMANENT_UNTIL`), so a
    ban can't be escaped by deleting and signing up again.
  Expired holds are deleted, after which the number can open a new account whose vote counts
  once. A longer hold already on a number is never shortened. All of this is disclosed in the
  KVKK text; the permanent hold still needs the legal review the KVKK draft is waiting for.

Admin accounts must be demoted before deletion.

## Profiles, badges and notifications

- `/u/<username>` shows username, optional display name, preset avatar, team, member-since
  month, badges, contribution points and live posts. Never phone, e-mail, real name, birth
  date or verification details.
- Profiles are **members-only by default** (signed-out visitors and search engines do not see
  them). A member can make the profile public; only public profiles go into the sitemap and
  are indexable. The province is hidden unless the member turns on "ilimi göster".
- Username and team cannot be changed from the profile.
- Badges and contribution points (XP) come only from live forum content: removed or held
  posts earn nothing, writing points are capped at 10 a day, and likes from other members
  add 2 each. They never touch `fan_votes`, counts or rankings, and the team a member supports
  plays no part.
- Notifications are in-site only (no SMS, e-mail or push). Replies, mentions and likes can be
  switched off per member; moderation, badge and system notices always arrive. A block in
  either direction stops notifications between the two members.

## Forum safety

- Likes: one per member per item, not on your own content.
- Reports: one open report per member per item; a moderator closes all open reports on the
  same item at once, with a reason, and the decision goes to `audit_log`.
- Blocks: hide the blocked member's posts from the blocker, stop replies to the blocker's
  topics and stop notifications. Staff cannot be blocked.
- There is no private messaging.

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
| `phone_holds` | 30 days after deletion; 1 year if the account voted; no end date if it was banned |
| `notifications` | 90 days (read or not) |
| `sessions` | 30 days after expiry or sign-out |
| `security_events` (hashed IP / browser only) | 1 year |
| `legal_acceptances` | while the account exists, then 10 years after deletion |
| `user_badges` | while the account exists |
| `forum_reports` | kept with the moderation record |
| `site_settings` | until changed (every change is in `audit_log`) |
| `audit_log`, `security_events` | append-only; no OTPs, passwords or phone numbers |

## Legal texts and consent

The texts live at `/kullanim-kosullari`, `/kvkk` (aydınlatma metni) and `/cerez-politikasi`.
Versions are in `src/lib/policy.ts` (`TERMS_VERSION`, `PRIVACY_NOTICE_VERSION`,
`COOKIE_POLICY_VERSION`); company details are placeholders in `LEGAL_ENTITY`
(`src/lib/legal.ts`). All pages still carry the "not reviewed by a lawyer" banner.

- Sign-up has three separate, unticked, required boxes: accept the terms, acknowledge the KVKK
  notice (an acknowledgement, not consent), and the age statement (18+, or 13–17 with a parent's
  permission). The server checks the submitted versions against the current ones.
- Each acceptance is a row in `legal_acceptances` (member, text, version, time, source). Rows
  can't be updated (trigger); older sign-ups were carried over from `users.terms_version`.
- When a version is bumped, `/api/auth/me` lists it in `legalPending`, the site shows a gate,
  and forum writes answer 403 until the member accepts (`POST /api/account/legal`).
- No açık rıza is collected: nothing the site does relies on consent. If a consent-based feature
  is added (e.g. marketing messages), it needs its own optional box that doesn't block sign-up.
- Only strictly necessary cookies are used, so there is no cookie banner.

Before launch: fill in the VERBİS status in `LEGAL_ENTITY`, the SMS provider and hosting placeholders in `/kvkk`,
sign the KVKK standard contract with US providers (Twilio if used, Cloudflare, Resend) and notify
the Authority within 5 business days, decide the audit-log retention period, check whether
VERBİS registration is required, and have a lawyer review all three texts.
