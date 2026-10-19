import assert from "node:assert/strict";
import { test } from "node:test";
import { captchaRequired, verifyCaptcha } from "./captcha";
import { netgsmAccepted, netgsmOtpXml, otpMessage, resolveSmsProvider } from "./sms";

const env = (over: Record<string, string | undefined>) =>
  ({ ...over }) as unknown as NodeJS.ProcessEnv;

test("production never uses the dev SMS inbox", () => {
  assert.equal(resolveSmsProvider(env({ NODE_ENV: "production", SMS_PROVIDER: "dev" })).name, "none");
  assert.equal(resolveSmsProvider(env({ NODE_ENV: "production" })).name, "none");
  assert.equal(resolveSmsProvider(env({ NODE_ENV: "development" })).name, "dev");
});

test("providers without full credentials fail closed", () => {
  assert.equal(
    resolveSmsProvider(env({ NODE_ENV: "production", SMS_PROVIDER: "netgsm", NETGSM_USERCODE: "u" })).name,
    "none",
  );
  assert.equal(
    resolveSmsProvider(
      env({
        NODE_ENV: "production",
        SMS_PROVIDER: "netgsm",
        NETGSM_USERCODE: "u",
        NETGSM_PASSWORD: "p",
        NETGSM_MSGHEADER: "BIZIMTRIBUN",
      }),
    ).name,
    "netgsm",
  );
  assert.equal(
    resolveSmsProvider(env({ NODE_ENV: "production", SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC1" })).name,
    "none",
  );
  assert.equal(
    resolveSmsProvider(
      env({
        NODE_ENV: "production",
        SMS_PROVIDER: "twilio",
        TWILIO_ACCOUNT_SID: "AC1",
        TWILIO_AUTH_TOKEN: "t",
        TWILIO_FROM: "+15550001111",
      }),
    ).name,
    "twilio",
  );
});

test("Netgsm request escapes credentials and parses the result code", () => {
  const xml = netgsmOtpXml({
    usercode: "a<b",
    password: "p&q",
    msgheader: "BT",
    phoneNorm: "5321234567",
    message: otpMessage("123456"),
  });
  assert.match(xml, /<usercode>a&lt;b<\/usercode>/);
  assert.match(xml, /<password>p&amp;q<\/password>/);
  assert.match(xml, /<no>5321234567<\/no>/);
  assert.equal(netgsmAccepted("<xml><main><code>0</code><jobID>1</jobID></main></xml>"), true);
  assert.equal(netgsmAccepted("<xml><main><code>00</code></main></xml>"), true);
  assert.equal(netgsmAccepted("<xml><main><code>41</code></main></xml>"), false);
  assert.equal(netgsmAccepted("garbage"), false);
});

test("CAPTCHA: required in production, unconfigured production fails closed", async () => {
  assert.equal(captchaRequired(env({ NODE_ENV: "production" })), true);
  assert.equal(captchaRequired(env({ NODE_ENV: "development" })), false);
  assert.deepEqual(await verifyCaptcha(undefined, "1.2.3.4", env({ NODE_ENV: "production" })), {
    ok: false,
    reason: "unconfigured",
  });
  assert.deepEqual(await verifyCaptcha(undefined, "1.2.3.4", env({ NODE_ENV: "development" })), { ok: true });
  assert.deepEqual(
    await verifyCaptcha("", "1.2.3.4", env({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: "s" })),
    { ok: false, reason: "missing" },
  );
});
