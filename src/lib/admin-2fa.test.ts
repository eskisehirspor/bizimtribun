import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeBase32, totpAt, totpOtpAuthUrl, verifyTotpCode } from "./totp";
import { decryptSecret, encryptSecret } from "./secret-box";
import { evaluateAdminGate } from "./admin-gate";
import {
  AUTH_TOTP_PER_USER_HOUR,
  SESSION_ADMIN_IDLE_MS,
  SESSION_ADMIN_TTL_MS,
  SESSION_TTL_MS,
} from "./policy";
import Database from "better-sqlite3";
import {
  completeLoginChallenge,
  confirmTotpSetup,
  createLoginChallenge,
  disableTotp,
  passwordLoginNextStep,
  recoveryCodeHash,
  remainingRecoveryCount,
  revokeUserSessionsOn,
  startTotpSetup,
  totpEnabledOn,
  totpVerifyLimited,
  noteTotpVerifyAttempt,
  updateUserPasswordHashOn,
} from "./admin-2fa";

test("RFC 6238 SHA1 6 hane + skew", () => {
  const secret = encodeBase32(Buffer.from("12345678901234567890"));
  assert.equal(totpAt(secret, 59_000), "287082");
  assert.equal(verifyTotpCode(secret, "287082", 59_000), true);
  assert.equal(verifyTotpCode(secret, "287082", 59_000 + 30_000), true);
  assert.equal(verifyTotpCode(secret, "000000", 59_000), false);
});

test("otpauth URI Google Authenticator uyumlu", () => {
  const url = totpOtpAuthUrl({ secret: "JBSWY3DPEHPK3PXP", accountName: "admin" });
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(url, /issuer=Bizim\+Trib%C3%BCn/);
  assert.equal(url.includes("JBSWY3DPEHPK3PXP"), true);
});

test("TOTP secret AES-GCM ile saklanır, plaintext değil", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const enc = encryptSecret(secret);
  assert.equal(enc.startsWith("v1."), true);
  assert.equal(enc.includes(secret), false);
  assert.equal(decryptSecret(enc), secret);
  assert.notEqual(encryptSecret(secret), enc);
});

test("requireAdmin kapısı korunur", () => {
  const anon = evaluateAdminGate(null);
  assert.equal(anon.ok, false);
  if (!anon.ok) assert.equal(anon.status, 401);
  const user = {
    role: "user",
    status: "active",
    banned_at: null,
    ban_expires_at: null,
  };
  const denied = evaluateAdminGate(user);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);
  const admin = { ...user, role: "admin" };
  assert.equal(evaluateAdminGate(admin).ok, true);
  const bannedAdmin = {
    ...admin,
    status: "banned",
    banned_at: "2026-09-01T00:00:00.000Z",
  };
  const banned = evaluateAdminGate(bannedAdmin);
  assert.equal(banned.ok, false);
  if (!banned.ok) assert.equal(banned.status, 403);
});

test("admin session TTL user'dan kısa", () => {
  assert.ok(SESSION_ADMIN_TTL_MS < SESSION_TTL_MS);
  assert.ok(SESSION_ADMIN_IDLE_MS > 0);
  assert.ok(SESSION_ADMIN_IDLE_MS < SESSION_ADMIN_TTL_MS);
});

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT NOT NULL DEFAULT 'x',
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_secret_enc TEXT,
      updated_at TEXT
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      last_seen_at TEXT
    );
    CREATE TABLE admin_totp_setup (
      user_id INTEGER PRIMARY KEY,
      secret_enc TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE admin_recovery_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE admin_login_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE TABLE security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      success INTEGER NOT NULL,
      ip_hash TEXT,
      ua_hash TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE register_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function addUser(db: Database.Database, username: string, role = "user") {
  const info = db
    .prepare(
      `INSERT INTO users (username, role, status, password_hash, updated_at)
       VALUES (?, ?, 'active', 'hash', ?)`,
    )
    .run(username, role, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

test("non-admin login etkilenmiyor", () => {
  assert.equal(passwordLoginNextStep({ role: "user", totp_enabled: 0 }), "session");
  assert.equal(passwordLoginNextStep({ role: "user", totp_enabled: 1 }), "session");
  assert.equal(passwordLoginNextStep({ role: "admin", totp_enabled: 0 }), "session");
});

test("admin + 2FA enabled → password only login session üretmez", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const code = totpAt(started.secret, Date.now());
  assert.ok(code);
  const confirmed = confirmTotpSetup(db, admin, code!, { ipHash: "ip" });
  assert.equal(confirmed.ok, true);
  assert.equal(passwordLoginNextStep({ role: "admin", totp_enabled: 1 }), "need2fa");
  const challenge = createLoginChallenge(db, admin);
  const sessions = (
    db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as { c: number }
  ).c;
  assert.equal(sessions, 0);
  assert.ok(challenge.length > 10);
  db.close();
});

test("2FA setup verify olmadan aktif olmuyor", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  assert.equal(started.ok, true);
  assert.equal(totpEnabledOn(db, admin), false);
  db.close();
});

test("doğru TOTP → challenge tamamlanır, yanlış reddedilir", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  if (!started.ok) throw new Error("setup");
  const now = Date.now();
  const setupCode = totpAt(started.secret, now)!;
  assert.equal(confirmTotpSetup(db, admin, setupCode, { ipHash: "setup" }).ok, true);
  const token = createLoginChallenge(db, admin);
  const bad = completeLoginChallenge(db, token, "000000", { ipHash: "login-ip" });
  assert.equal(bad.ok, false);
  const token2 = createLoginChallenge(db, admin);
  const good = completeLoginChallenge(db, token2, totpAt(started.secret, now)!, {
    ipHash: "login-ip-2",
  });
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.userId, admin);
  db.close();
});

test("TOTP brute force rate limit", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  if (!started.ok) throw new Error("setup");
  assert.equal(
    confirmTotpSetup(db, admin, totpAt(started.secret, Date.now())!, {
      ipHash: "s",
    }).ok,
    true,
  );
  const ip = "brute-ip";
  for (let i = 0; i < AUTH_TOTP_PER_USER_HOUR; i++) {
    noteTotpVerifyAttempt(db, ip, admin);
  }
  assert.equal(totpVerifyLimited(db, ip, admin), true);
  const token = createLoginChallenge(db, admin);
  const limited = completeLoginChallenge(db, token, "123456", { ipHash: ip });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.status, 429);
  db.close();
});

test("recovery code tek kullanımlık ve plaintext saklanmıyor", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  if (!started.ok) throw new Error("setup");
  const confirmed = confirmTotpSetup(db, admin, totpAt(started.secret, Date.now())!, {
    ipHash: "s",
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  const dump = db
    .prepare(`SELECT code_hash FROM admin_recovery_codes`)
    .all() as { code_hash: string }[];
  for (const row of dump) {
    assert.match(row.code_hash, /^[a-f0-9]{64}$/);
    for (const code of confirmed.recoveryCodes) {
      assert.equal(row.code_hash.includes(code), false);
      assert.equal(row.code_hash.includes(code.replace("-", "")), false);
    }
  }
  assert.equal(remainingRecoveryCount(db, admin), 10);
  const code = confirmed.recoveryCodes[0]!;
  const token = createLoginChallenge(db, admin);
  const first = completeLoginChallenge(db, token, code, { ipHash: "rec1" });
  assert.equal(first.ok, true);
  assert.equal(remainingRecoveryCount(db, admin), 9);
  const token2 = createLoginChallenge(db, admin);
  const second = completeLoginChallenge(db, token2, code, { ipHash: "rec2" });
  assert.equal(second.ok, false);
  assert.equal(recoveryCodeHash(admin, code).length, 64);
  const events = db
    .prepare(`SELECT action FROM security_events WHERE action = 'recovery_code_used'`)
    .all() as { action: string }[];
  assert.equal(events.length, 1);
  db.close();
});

test("role değişikliği session revoke", () => {
  const db = openDb();
  const target = addUser(db, "hedef", "user");
  const mod = addUser(db, "mod", "admin");
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, created_at, revoked_at)
     VALUES (?, 't1', '2099-01-01', '2026-01-01', NULL), (?, 'm1', '2099-01-01', '2026-01-01', NULL)`,
  ).run(target, mod);
  db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(target);
  revokeUserSessionsOn(db, target);
  const t = db
    .prepare(`SELECT revoked_at FROM sessions WHERE token_hash = 't1'`)
    .get() as { revoked_at: string | null };
  const m = db
    .prepare(`SELECT revoked_at FROM sessions WHERE token_hash = 'm1'`)
    .get() as { revoked_at: string | null };
  assert.ok(t.revoked_at);
  assert.equal(m.revoked_at, null);
  db.close();
});

test("password/2FA security change session revoke", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, created_at)
     VALUES (?, 'live', '2099-01-01', '2026-01-01')`,
  ).run(admin);
  updateUserPasswordHashOn(db, admin, "new-hash");
  const afterPass = db
    .prepare(`SELECT revoked_at FROM sessions WHERE token_hash = 'live'`)
    .get() as { revoked_at: string | null };
  assert.ok(afterPass.revoked_at);

  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  if (!started.ok) throw new Error("setup");
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, created_at)
     VALUES (?, 'live2', '2099-01-01', '2026-01-01')`,
  ).run(admin);
  confirmTotpSetup(db, admin, totpAt(started.secret, Date.now())!, { ipHash: "x" });
  const after2fa = db
    .prepare(`SELECT revoked_at FROM sessions WHERE token_hash = 'live2'`)
    .get() as { revoked_at: string | null };
  assert.ok(after2fa.revoked_at);
  db.close();
});

test("2FA disable password+code ve audit", () => {
  const db = openDb();
  const admin = addUser(db, "mod", "admin");
  const started = startTotpSetup(db, { id: admin, username: "mod", role: "admin" });
  if (!started.ok) throw new Error("setup");
  const confirmed = confirmTotpSetup(db, admin, totpAt(started.secret, Date.now())!, {
    ipHash: "s",
  });
  assert.equal(confirmed.ok, true);
  const user = db
    .prepare(`SELECT id, totp_secret_enc, totp_enabled FROM users WHERE id = ?`)
    .get(admin) as {
    id: number;
    totp_secret_enc: string | null;
    totp_enabled: number;
  };
  const disabled = disableTotp(db, user, totpAt(started.secret, Date.now())!, {
    ipHash: "d",
  });
  assert.equal(disabled.ok, true);
  assert.equal(totpEnabledOn(db, admin), false);
  const ev = db
    .prepare(`SELECT action, success FROM security_events WHERE action = 'totp_disable'`)
    .get() as { action: string; success: number };
  assert.equal(ev.success, 1);
  db.close();
});
