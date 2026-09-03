import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { otpCodeHash } from "./crypto";
import {
  parsePhoneVerificationEnabled,
  participantMeetsVoteVerification,
} from "./phone-verification";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "./policy";

test("PHONE_VERIFICATION_ENABLED parse", () => {
  assert.equal(parsePhoneVerificationEnabled(undefined), false);
  assert.equal(parsePhoneVerificationEnabled(""), false);
  assert.equal(parsePhoneVerificationEnabled("false"), false);
  assert.equal(parsePhoneVerificationEnabled("true"), true);
  assert.equal(parsePhoneVerificationEnabled("1"), true);
  assert.equal(parsePhoneVerificationEnabled("yes"), true);
});

test("OTP altyapısı flag false iken kaybolmuyor", () => {
  assert.equal(parsePhoneVerificationEnabled("false"), false);
  assert.ok(OTP_TTL_MS > 0);
  assert.ok(OTP_MAX_ATTEMPTS >= 1);
  assert.equal(otpCodeHash(1, "123456").length, 64);
  const dir = dirname(fileURLToPath(import.meta.url));
  const otpSrc = readFileSync(join(dir, "otp.ts"), "utf8");
  assert.match(otpSrc, /export async function requestPhoneOtp/);
  assert.match(otpSrc, /export function consumePhoneOtp/);
  assert.match(otpSrc, /phone_otps/);
  const smsSrc = readFileSync(join(dir, "sms.ts"), "utf8");
  assert.match(smsSrc, /getSmsProvider/);
});

test("oy elverişliliği flag'e göre", () => {
  const emailOnly = { verified_at: "t", phone_verified_at: null };
  const both = { verified_at: "t", phone_verified_at: "t" };
  const none = { verified_at: null, phone_verified_at: null };
  assert.equal(participantMeetsVoteVerification(emailOnly, false), true);
  assert.equal(participantMeetsVoteVerification(emailOnly, true), false);
  assert.equal(participantMeetsVoteVerification(both, true), true);
  assert.equal(participantMeetsVoteVerification(none, false), false);
});
