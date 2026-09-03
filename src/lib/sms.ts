import fs from "fs";
import path from "path";

export type SmsOtpPayload = {
  phoneNorm: string;
  code: string;
};

export type SmsProvider = {
  sendOtp(payload: SmsOtpPayload): Promise<void>;
};

function isProd() {
  return process.env.NODE_ENV === "production";
}

/** Writes the code to a local file only. Never used in production. */
const devFileProvider: SmsProvider = {
  async sendOtp(payload) {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "last-otp.txt"),
      `${payload.phoneNorm}\n${payload.code}\n`,
      "utf8",
    );
  },
};

/** Placeholder until a real vendor is wired. Must not send or leak codes. */
const unconfiguredProvider: SmsProvider = {
  async sendOtp() {
    throw new Error("SMS_NOT_CONFIGURED");
  },
};

export function getSmsProvider(): SmsProvider {
  return isProd() ? unconfiguredProvider : devFileProvider;
}

export function isDevSmsInbox() {
  return !isProd();
}

export function smsDeliveryAvailable() {
  return !isProd();
}
