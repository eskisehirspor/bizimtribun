# Roles and admin panel

Roles live in `users.role` and are checked on the server for every admin request
(`src/lib/permissions.ts`). The client only hides buttons. A member cannot change their own
role through any API: profile updates reject unknown fields, and role changes go through
`/api/admin/users/<id>/role`, which only a super admin may call.

| Permission | Moderator | Admin | Super admin |
| --- | :-: | :-: | :-: |
| Admin panel, forum moderation, held-content queue, member reports | ✓ | ✓ | ✓ |
| Member list and detail (phone masked), ban/unban ordinary members | ✓ | ✓ | ✓ |
| Ban moderators (admins must be demoted first), see full phone / e-mail (`users.pii`) | | ✓ | ✓ |
| Void a vote with a reason (`votes.void`) | | ✓ | ✓ |
| Undo a mistaken void (`votes.restore`) | | | ✓ |
| Teams, leagues, seasons, team requests | | ✓ | ✓ |
| Dashboard, audit log | | ✓ | ✓ |
| Site content: announcement, featured topics, home leagues, SEO texts, social links | | ✓ | ✓ |
| Roles (`roles.manage`), maintenance mode and feature flags (`settings.manage`) | | | ✓ |

Rules enforced on the server:

- Nobody can change their own role; the last super admin cannot be demoted; a role change
  revokes the member's sessions and is audited.
- Staff must turn on TOTP 2FA first. Without it only `/admin/guvenlik` (`security.self`)
  works; every other admin page and API answers 403. Later staff logins ask for the TOTP
  code after the SMS code, and a code can't be reused within its window.
- There is no "log in as member" feature.
- There is no way to move a vote to another team. A vote can only be voided, with a reason,
  and that is audited; the account cannot vote again. A super admin can undo a mistaken
  void: the same vote row comes back with its original team, province and cast time, the
  undo is written to `fan_vote_restores` and `audit_log`, and a database trigger refuses
  the change without that record. Votes of deleted accounts can't be restored.
- Signed-in members who call a staff-only endpoint are recorded in `security_events`
  (`admin_denied:<permission>`) and counted on the dashboard.

## Dashboard figures

All figures are plain counts over live rows; the system account that owns pinned starter
topics is not counted as a member.

| Card | Definition |
| --- | --- |
| Aktif hesap | Not deleted, not under an active ban |
| Telefonu doğrulanmış | `phone_verified_at` set, not deleted |
| Geçerli takım oyu | `fan_votes.status = 'active'` |
| Yeni kayıt (24 saat / 7 / 30 gün) | Accounts created in the window, not deleted |
| Eski sayım oyu | Old e-mail census ballots; not part of any public count |
| Yeni konu / yorum (7 gün) | Live (not removed, not held) items created in the window |
| Açık rapor / Onay bekleyen | Open `forum_reports` / auto-held topics and posts |
| SMS kodu talebi, kilitlenen kod | `auth_otps` rows in the last 24 h / of those, locked by wrong guesses |
| En yoğun saatte kayıt | Most sign-ups in one clock hour over the last 24 h |
| Yetkisiz yönetim denemesi | `admin_denied:*` security events in the last 24 h |
| Başarısız yönetici girişi | Other failed security events (password / 2FA) in the last 24 h |
| İptal edilen oy (30 gün) | Votes voided in the last 30 days |

## Tribune leader

Each month's leader of a team tribune is the member with the highest score on that board:
active days (Istanbul calendar days with at least one public topic or reply) × 3, plus likes
received that month from other members, at most 3 from any one liker. Ties go to more active
days, then the earliest post. Removed or held content, banned accounts and the system
account don't count. Records from before this rule show only their post count.

## Site settings (`/admin/ayarlar`)

Each block is saved on its own and audited as `setting_<key>`. Text is stored as plain text
(control characters and `<` `>` removed); links must be `https://` or a same-site path.
Featured topic ids must point at live topics. Feature flags: new sign-ups, team requests,
likes, the general board and the province boards. Closing a board hides it and its topics
(including from the sitemap) without deleting anything; reopening brings them back.
