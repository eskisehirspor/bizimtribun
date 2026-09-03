import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { hmac } from "./crypto";
import { isTrMobile, normalizePhone } from "./phone";
import {
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./policy";
import {
  OTP_REQUEST_GENERIC_MESSAGE,
  findOtpParticipantByPhoneHash,
  otpRequestAcceptedBody,
  participantEligibleForOtpSend,
  preludeOtpRequest,
} from "./otp-request";

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE register_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_hash TEXT,
      deleted_at TEXT,
      phone_verified_at TEXT
    );
    CREATE TABLE phone_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      phone_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function addParticipant(
  db: Database.Database,
  phoneHash: string,
  extra?: { deleted?: boolean; verified?: boolean },
) {
  const info = db
    .prepare(
      `INSERT INTO participants (phone_hash, deleted_at, phone_verified_at)
       VALUES (?, ?, ?)`,
    )
    .run(
      phoneHash,
      extra?.deleted ? "2026-01-01T00:00:00.000Z" : null,
      extra?.verified ? "2026-01-01T00:00:00.000Z" : null,
    );
  return Number(info.lastInsertRowid);
}

function keys(phoneHash: string, ip = "ip-a") {
  return {
    ipHash: hmac(`ip:otp:${ip}`),
    phoneKey: hmac(`ip:otp-phone:${phoneHash}`),
    phoneHash,
  };
}

function clearPhoneCooldown(db: Database.Database, phoneKey: string) {
  db.prepare(`UPDATE register_attempts SET created_at = ? WHERE ip_hash = ?`).run(
    new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000).toISOString(),
    phoneKey,
  );
}

test("kayıtlı ve kayıtsız telefon aynı generic accepted response", () => {
  const db = openDb();
  addParticipant(db, "ph-known");
  const knownPrelude = preludeOtpRequest(db, keys("ph-known", "ip-k"));
  const unknownPrelude = preludeOtpRequest(db, keys("ph-unknown", "ip-u"));
  assert.equal(knownPrelude.ok, true);
  assert.equal(unknownPrelude.ok, true);
  if (!knownPrelude.ok || !unknownPrelude.ok) return;
  assert.equal(knownPrelude.dispatch, true);
  assert.equal(unknownPrelude.dispatch, false);

  const known = otpRequestAcceptedBody();
  const unknown = otpRequestAcceptedBody();
  assert.deepEqual(known, unknown);
  assert.equal(known.ok, true);
  assert.equal(known.message, OTP_REQUEST_GENERIC_MESSAGE);
  assert.equal(known.expiresInSec, Math.floor(OTP_TTL_MS / 1000));
  assert.equal("error" in known, false);
  const text = JSON.stringify(known);
  assert.equal(text.includes("açık kayıt"), false);
  assert.equal(text.includes("kayıt yok"), false);
  db.close();
});

test("prelude: kayıtlı telefon dispatch, kayıtsız aynı kapı ve OTP yok", () => {
  const db = openDb();
  const phoneHash = "ph-live";
  addParticipant(db, phoneHash);
  const live = preludeOtpRequest(db, keys(phoneHash, "ip-1"));
  assert.equal(live.ok, true);
  if (!live.ok) return;
  assert.equal(live.dispatch, true);

  const missing = preludeOtpRequest(db, keys("ph-missing", "ip-2"));
  assert.equal(missing.ok, true);
  if (!missing.ok) return;
  assert.equal(missing.dispatch, false);
  assert.equal(missing.participant, undefined);

  const otps = (
    db.prepare(`SELECT COUNT(*) as c FROM phone_otps`).get() as { c: number }
  ).c;
  assert.equal(otps, 0);
  db.close();
});

test("response body telefonun varlığını ele vermiyor", () => {
  const db = openDb();
  addParticipant(db, "ph-a");
  const a = preludeOtpRequest(db, keys("ph-a", "ipa"));
  const b = preludeOtpRequest(db, keys("ph-b", "ipb"));
  assert.equal(a.ok, b.ok);
  const bodyA = otpRequestAcceptedBody();
  const bodyB = otpRequestAcceptedBody();
  assert.deepEqual(bodyA, bodyB);
  db.close();
});

test("rate limit kayıtlı ve kayıtsız numarada çalışır", () => {
  const db = openDb();
  const missingHash = "ph-ghost";
  const liveHash = "ph-real";
  addParticipant(db, liveHash);

  for (let i = 0; i < OTP_PER_PHONE_HOUR; i++) {
    const k = keys(missingHash, `ghost-ip-${i}`);
    const ok = preludeOtpRequest(db, k);
    assert.equal(ok.ok, true);
    clearPhoneCooldown(db, k.phoneKey);
  }
  const ghostLimited = preludeOtpRequest(db, keys(missingHash, "ghost-ip-x"));
  assert.equal(ghostLimited.ok, false);
  if (!ghostLimited.ok) assert.equal(ghostLimited.status, 429);

  const db2 = openDb();
  addParticipant(db2, liveHash);
  for (let i = 0; i < OTP_PER_PHONE_HOUR; i++) {
    const k = keys(liveHash, `live-ip-${i}`);
    const ok = preludeOtpRequest(db2, k);
    assert.equal(ok.ok, true);
    clearPhoneCooldown(db2, k.phoneKey);
  }
  const liveLimited = preludeOtpRequest(db2, keys(liveHash, "live-ip-x"));
  assert.equal(liveLimited.ok, false);
  if (!liveLimited.ok) assert.equal(liveLimited.status, 429);
  db.close();
  db2.close();
});

test("kayıt olmayan telefon için OTP DB kaydı yok", () => {
  const db = openDb();
  const r = preludeOtpRequest(db, keys("nope", "ipz"));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.dispatch, false);
  assert.equal(
    (db.prepare(`SELECT COUNT(*) as c FROM phone_otps`).get() as { c: number }).c,
    0,
  );
  db.close();
});

test("kayıt olmayan / uygun olmayan için SMS dispatch yok", () => {
  const db = openDb();
  addParticipant(db, "gone", { deleted: true });
  addParticipant(db, "done", { verified: true });
  const deleted = preludeOtpRequest(db, keys("gone", "ip-d"));
  const verified = preludeOtpRequest(db, keys("done", "ip-v"));
  const missing = preludeOtpRequest(db, keys("none", "ip-n"));
  assert.equal(deleted.ok && deleted.dispatch, false);
  assert.equal(verified.ok && verified.dispatch, false);
  assert.equal(missing.ok && missing.dispatch, false);
  assert.equal(participantEligibleForOtpSend(undefined), false);
  db.close();
});

test("invalid format için validation davranışı korunuyor", () => {
  assert.equal(isTrMobile(normalizePhone("123")), false);
  assert.equal(isTrMobile(normalizePhone("5551234567")), true);
  assert.equal(isTrMobile(normalizePhone("02121234567")), false);
});

test("kayıtlı/kayıtsız prelude aynı iş sırası (lookup her zaman)", () => {
  const db = openDb();
  addParticipant(db, "ph-t");
  const t0 = process.hrtime.bigint();
  preludeOtpRequest(db, keys("ph-t", "t0"));
  const knownNs = process.hrtime.bigint() - t0;
  const t1 = process.hrtime.bigint();
  preludeOtpRequest(db, keys("ph-no", "t1"));
  const unknownNs = process.hrtime.bigint() - t1;
  assert.equal(findOtpParticipantByPhoneHash(db, "ph-t")?.id != null, true);
  assert.equal(findOtpParticipantByPhoneHash(db, "ph-no"), undefined);
  const deltaMs = Number(knownNs > unknownNs ? knownNs - unknownNs : unknownNs - knownNs) / 1e6;
  assert.ok(deltaMs < 200, `prelude timing delta ${deltaMs}ms`);
  db.close();
});

test("IP saat limiti kayıtlı ve kayıtsız numarada çalışır", () => {
  const db = openDb();
  addParticipant(db, "live-ip-limit");
  const ip = "same-ip";
  for (let i = 0; i < OTP_PER_IP_HOUR; i++) {
    const ok = preludeOtpRequest(db, keys(`ghost-${i}`, ip));
    assert.equal(ok.ok, true);
  }
  const limitedUnknown = preludeOtpRequest(db, keys("ghost-next", ip));
  assert.equal(limitedUnknown.ok, false);
  if (!limitedUnknown.ok) assert.equal(limitedUnknown.status, 429);

  const db2 = openDb();
  addParticipant(db2, "live-ip-limit");
  for (let i = 0; i < OTP_PER_IP_HOUR; i++) {
    const hash = i === 0 ? "live-ip-limit" : `other-${i}`;
    if (i > 0) addParticipant(db2, hash);
    const ok = preludeOtpRequest(db2, keys(hash, ip));
    assert.equal(ok.ok, true);
  }
  const limitedKnown = preludeOtpRequest(db2, keys("live-ip-limit", ip));
  assert.equal(limitedKnown.ok, false);
  if (!limitedKnown.ok) assert.equal(limitedKnown.status, 429);
  db.close();
  db2.close();
});

test("yeniden gönderim beklemesi kayıt olmayan numarada da uygulanır", () => {
  const db = openDb();
  const first = preludeOtpRequest(db, keys("ghost-cd", "cd-ip"));
  assert.equal(first.ok, true);
  const second = preludeOtpRequest(db, keys("ghost-cd", "cd-ip-2"));
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.status, 429);
    assert.equal(second.error, "Yeni kod için biraz bekle.");
  }
  db.close();
});

test("OTP request route kayıt yokken 404 ile enumeration yapmaz", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const route = readFileSync(
    join(dir, "../app/api/otp/request/route.ts"),
    "utf8",
  );
  assert.match(route, /preludeOtpRequest/);
  assert.match(route, /otpRequestAcceptedBody/);
  assert.equal(route.includes("404"), false);
  assert.equal(route.includes("açık kayıt yok"), false);
  assert.equal(route.includes("PHONE_VERIFICATION_ENABLED"), false);
});
