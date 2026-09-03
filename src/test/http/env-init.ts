import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.BIZIM_TRIBUN_TEST = "1";
process.env.TRUST_PROXY = "forwarded";
process.env.APP_SECRET =
  process.env.APP_SECRET || "http-integration-test-secret-32ch";
if (!process.env.PHONE_VERIFICATION_ENABLED) {
  process.env.PHONE_VERIFICATION_ENABLED = "false";
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-http-"));
process.env.BIZIM_TRIBUN_DB = path.join(dir, "boot.db");
export const httpTestRoot = dir;
