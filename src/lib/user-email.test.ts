import assert from "node:assert/strict";
import { test } from "node:test";
import { requireActiveUser, requireForumWriter } from "./auth";
import { FORUM_PHONE_UNVERIFIED_ERROR } from "./policy";
import type { UserRow } from "./users";
import { LEGAL_PENDING_ERROR } from "./legal";

// Legal acceptance is covered by the HTTP tests; here it is always current.
const w = (u: UserRow | undefined) => requireForumWriter(u, () => false);

function row(over: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    username: "taraftar",
    username_norm: "taraftar",
    display_name: "Ali Veli",
    email: "a@example.com",
    email_norm: "a@example.com",
    password_hash: "x",
    team_id: "galatasaray",
    status: "active",
    role: "user",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    last_login_at: null,
    banned_at: null,
    ban_reason: null,
    ban_expires_at: null,
    participant_id: null,
    first_name: "Ali",
    last_name: "Veli",
    birth_date: "1990-01-01",
    phone: "+905321111111",
    phone_norm: "5321111111",
    city: "İstanbul",
    totp_enabled: 0,
    totp_secret_enc: null,
    email_verified_at: null,
    phone_verified_at: null,
    deleted_at: null,
    terms_version: null,
    terms_accepted_at: null,
    ...over,
  };
}

test("requireForumWriter: unverified 403, verified ok, banned first", () => {
  const guest = w(undefined);
  assert.equal(guest.ok, false);
  if (!guest.ok) assert.equal(guest.status, 401);

  const unverified = w(row());
  assert.equal(unverified.ok, false);
  if (!unverified.ok) {
    assert.equal(unverified.status, 403);
    assert.equal(unverified.error, FORUM_PHONE_UNVERIFIED_ERROR);
  }

  const banned = w(
    row({ status: "banned", banned_at: "2026-01-02T00:00:00.000Z" }),
  );
  assert.equal(banned.ok, false);
  if (!banned.ok) {
    assert.equal(banned.status, 403);
    assert.equal(banned.error, "Hesap askıya alınmış.");
  }

  const bannedUnverified = w(
    row({
      status: "banned",
      banned_at: "2026-01-02T00:00:00.000Z",
      phone_verified_at: null,
    }),
  );
  assert.equal(bannedUnverified.ok, false);
  if (!bannedUnverified.ok) {
    assert.equal(bannedUnverified.error, "Hesap askıya alınmış.");
  }

  const expiredBan = w(
    row({
      status: "banned",
      banned_at: "2026-01-01T00:00:00.000Z",
      ban_expires_at: "2026-01-02T00:00:00.000Z",
      phone_verified_at: "2026-01-03T00:00:00.000Z",
    }),
  );
  assert.equal(expiredBan.ok, true);

  const adminUnverified = w(row({ role: "admin" }));
  assert.equal(adminUnverified.ok, false);
  if (!adminUnverified.ok) {
    assert.equal(adminUnverified.error, FORUM_PHONE_UNVERIFIED_ERROR);
  }

  const verified = w(
    row({ phone_verified_at: "2026-01-03T00:00:00.000Z" }),
  );
  assert.equal(verified.ok, true);

  const active = requireActiveUser(row());
  assert.equal(active.ok, true);

  const outdated = requireForumWriter(row({ phone_verified_at: "2026-01-03T00:00:00.000Z" }), () => true);
  assert.equal(outdated.ok, false);
  if (!outdated.ok) assert.equal(outdated.error, LEGAL_PENDING_ERROR);
});
