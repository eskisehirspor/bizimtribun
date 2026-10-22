import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.BIZIM_TRIBUN_TEST = "1";
process.env.TRUST_PROXY = "forwarded";
process.env.APP_SECRET =
  process.env.APP_SECRET || "http-integration-test-secret-32ch";
process.env.SMS_PROVIDER = "dev";
// Most suites drive the SMS flow; e-mail tests switch this per test.
process.env.VERIFY_CHANNEL = "sms";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-http-"));
export const httpTestRoot = dir;
