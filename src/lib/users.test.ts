import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectiveUserStatus,
  isBanExpired,
  isUserBanned,
  toPublicUser,
  type UserRow,
} from "./users";

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
    ...over,
  };
}

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const PAST = "2026-09-01T00:00:00.000Z";
const FUTURE = "2026-12-31T00:00:00.000Z";

test("isUserBanned: kalıcı ban → banned", () => {
  assert.equal(
    isUserBanned(
      row({ status: "banned", banned_at: PAST, ban_expires_at: null }),
      NOW,
    ),
    true,
  );
});

test("isUserBanned: gelecekte biten ban → banned", () => {
  assert.equal(
    isUserBanned(
      row({ status: "banned", banned_at: PAST, ban_expires_at: FUTURE }),
      NOW,
    ),
    true,
  );
});

test("isUserBanned: süresi geçmiş ban → active", () => {
  const expired = row({
    status: "banned",
    banned_at: PAST,
    ban_expires_at: PAST,
  });
  assert.equal(isUserBanned(expired, NOW), false);
  assert.equal(isBanExpired(expired, NOW), true);
  assert.equal(effectiveUserStatus(expired, NOW), "active");
  assert.equal(toPublicUser(expired).status, "active");
});

test("effectiveUserStatus: aktif banlı hesap banned döner", () => {
  assert.equal(
    effectiveUserStatus(
      row({ status: "banned", banned_at: PAST, ban_expires_at: FUTURE }),
      NOW,
    ),
    "banned",
  );
});
