import assert from "node:assert/strict";
import { test } from "node:test";
import { isDisposableEmail } from "./disposable";
import { verifyChannel } from "./verify-channel";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

test("e-mail is the default channel; only VERIFY_CHANNEL=sms switches to SMS", () => {
  assert.equal(verifyChannel(env({})), "email");
  assert.equal(verifyChannel(env({ VERIFY_CHANNEL: "email" })), "email");
  assert.equal(verifyChannel(env({ VERIFY_CHANNEL: " SMS " })), "sms");
  assert.equal(verifyChannel(env({ VERIFY_CHANNEL: "whatsapp" })), "email");
});

test("throwaway domains are caught, subdomains included; ordinary ones pass", () => {
  assert.equal(isDisposableEmail("a@mailinator.com"), true);
  assert.equal(isDisposableEmail("a@x.yopmail.com"), true);
  assert.equal(isDisposableEmail("a@MAILINATOR.COM"), true);
  assert.equal(isDisposableEmail("a@gmail.com"), false);
  assert.equal(isDisposableEmail("a@hotmail.com.tr"), false);
  assert.equal(isDisposableEmail("no-at-sign"), true);
});
