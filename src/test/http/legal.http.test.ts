import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";
import { GET as me } from "../../app/api/auth/me/route";
import { POST as acceptLegal } from "../../app/api/account/legal/route";
import { POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { getDb } from "@/lib/db";
import { LEGAL_DOCS, LEGAL_PENDING_ERROR } from "@/lib/legal";
import { freshDb, invoke, LEGAL_OK, signupCookie, smsSignup, trPhone, uniq } from "./harness";

beforeEach(() => {
  freshDb();
});

test("sign-up needs each box ticked and stores both versions", async () => {
  const phone = trPhone(7301);
  const sent = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { phone } });
  const code = (sent.json as { devCode: string }).devCode;
  const verified = await invoke(otpVerify, { method: "POST", path: "/api/auth/otp/verify", body: { phone, code } });
  const base = { username: uniq("lg").slice(0, 20), teamId: "galatasaray", city: null, confirmTeamLocked: true };
  for (const missing of ["acceptTerms", "acknowledgePrivacy", "confirmAge"] as const) {
    const body: Record<string, unknown> = { ...base, ...LEGAL_OK };
    delete body[missing];
    const res = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie: signupCookie(verified.res), body });
    assert.equal(res.status, 400, missing);
  }
  const stale = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: signupCookie(verified.res),
    body: { ...base, ...LEGAL_OK, termsVersion: "2000-01-01" },
  });
  assert.equal(stale.status, 409, stale.text);

  const u = await smsSignup({ phone: trPhone(7302), username: uniq("lg").slice(0, 20) });
  const rows = getDb()
    .prepare(`SELECT doc, version, source FROM legal_acceptances WHERE user_id = ? ORDER BY doc`)
    .all(u.id) as { doc: string; version: string; source: string }[];
  assert.deepEqual(rows, [
    { doc: "privacy", version: LEGAL_DOCS.privacy.version, source: "signup" },
    { doc: "terms", version: LEGAL_DOCS.terms.version, source: "signup" },
  ]);
  const who = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.deepEqual((who.json as { legalPending: unknown[] }).legalPending, []);
});

test("a new text version blocks writing until the member accepts it", async () => {
  const u = await smsSignup({ phone: trPhone(7303), username: uniq("lg").slice(0, 20) });
  // As if the member had only accepted older versions.
  getDb().prepare(`DELETE FROM legal_acceptances WHERE user_id = ?`).run(u.id);
  getDb()
    .prepare(`INSERT INTO legal_acceptances (user_id, doc, version, accepted_at, source) VALUES (?, 'terms', '2026-10-19', ?, 'legacy')`)
    .run(u.id, new Date().toISOString());

  const who = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  const pending = (who.json as { legalPending: { doc: string }[] }).legalPending.map((d) => d.doc).sort();
  assert.deepEqual(pending, ["privacy", "terms"]);

  const topic = { title: "Yeni sezon beklentileri", content: "Bu sene nasıl geçer sizce?" };
  const blocked = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: u.cookie, body: topic });
  assert.equal(blocked.status, 403);
  assert.equal((blocked.json as { error: string }).error, LEGAL_PENDING_ERROR);

  const old = await invoke(acceptLegal, {
    method: "POST",
    path: "/api/account/legal",
    cookie: u.cookie,
    body: { accepted: [{ doc: "terms", version: "2026-10-19" }] },
  });
  assert.equal(old.status, 409);

  const ok = await invoke(acceptLegal, {
    method: "POST",
    path: "/api/account/legal",
    cookie: u.cookie,
    body: {
      accepted: [
        { doc: "terms", version: LEGAL_DOCS.terms.version },
        { doc: "privacy", version: LEGAL_DOCS.privacy.version },
      ],
    },
  });
  assert.equal(ok.status, 200, ok.text);
  assert.deepEqual((ok.json as { pending: unknown[] }).pending, []);
  const created = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: u.cookie, body: topic });
  assert.equal(created.status, 201, created.text);
  // The old record is kept; acceptance rows can't be rewritten.
  assert.throws(() => getDb().prepare(`UPDATE legal_acceptances SET version = 'x' WHERE user_id = ?`).run(u.id), /LEGAL_RECORD_IMMUTABLE/);
});
