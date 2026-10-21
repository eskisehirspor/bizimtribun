import fs from "fs";
import path from "path";

/**
 * SMS delivery for one-time codes.
 *
 * Provider is picked by SMS_PROVIDER:
 *   netgsm  — Netgsm OTP endpoint (NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_MSGHEADER)
 *   twilio  — Twilio Messages API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *             TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID)
 *   dev     — development only: code goes to an in-memory outbox and
 *             data/last-otp.txt. Refused when NODE_ENV=production.
 *
 * Production with no provider, or with missing credentials, fails closed:
 * no code is created and the request is answered 503. Codes are never logged.
 */
export type SmsOtpPayload = {
  /** National 10-digit form, e.g. 5321234567. */
  phoneNorm: string;
  code: string;
};

export type SmsProvider = {
  name: "netgsm" | "twilio" | "dev" | "none";
  sendOtp(payload: SmsOtpPayload): Promise<void>;
};

export class SmsSendError extends Error {
  constructor(
    message: "SMS_NOT_CONFIGURED" | "SMS_PROVIDER_REJECTED" | "SMS_NETWORK",
  ) {
    super(message);
  }
}

const SEND_TIMEOUT_MS = 8_000;

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function otpMessage(code: string) {
  return `Bizim Tribun dogrulama kodun: ${code}. Kodu kimseyle paylasma.`;
}

const devOutbox = new Map<string, string>();

/** Test/dev helper. Always empty in production because the dev provider is refused there. */
export function peekDevOutbox(phoneNorm: string) {
  return devOutbox.get(phoneNorm);
}

const devProvider: SmsProvider = {
  name: "dev",
  async sendOtp(payload) {
    devOutbox.set(payload.phoneNorm, payload.code);
    if (process.env.SMS_DEV_FILE === "0" || process.env.BIZIM_TRIBUN_TEST === "1") {
      return;
    }
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "last-otp.txt"),
      `${payload.phoneNorm}\n${payload.code}\n`,
      "utf8",
    );
  },
};

const unconfiguredProvider: SmsProvider = {
  name: "none",
  async sendOtp() {
    throw new SmsSendError("SMS_NOT_CONFIGURED");
  },
};

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function netgsmOtpXml(input: {
  usercode: string;
  password: string;
  msgheader: string;
  phoneNorm: string;
  message: string;
}) {
  return `<?xml version="1.0"?>
<mainbody>
  <header>
    <usercode>${xmlEscape(input.usercode)}</usercode>
    <password>${xmlEscape(input.password)}</password>
    <msgheader>${xmlEscape(input.msgheader)}</msgheader>
  </header>
  <body>
    <msg><![CDATA[${input.message}]]></msg>
    <no>${xmlEscape(input.phoneNorm)}</no>
  </body>
</mainbody>`;
}

/** Netgsm answers `<code>0</code>` (or 00) plus a jobID on success. */
export function netgsmAccepted(responseText: string) {
  const code = /<code>\s*(\d+)\s*<\/code>/i.exec(responseText)?.[1];
  return code === "0" || code === "00";
}

function netgsmProvider(env: NodeJS.ProcessEnv): SmsProvider | null {
  const usercode = env.NETGSM_USERCODE?.trim();
  const password = env.NETGSM_PASSWORD?.trim();
  const msgheader = env.NETGSM_MSGHEADER?.trim();
  if (!usercode || !password || !msgheader) return null;
  const url = env.NETGSM_OTP_URL?.trim() || "https://api.netgsm.com.tr/sms/send/otp";
  return {
    name: "netgsm",
    async sendOtp({ phoneNorm, code }) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/xml; charset=utf-8" },
          body: netgsmOtpXml({
            usercode,
            password,
            msgheader,
            phoneNorm,
            message: otpMessage(code),
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
      } catch {
        throw new SmsSendError("SMS_NETWORK");
      }
      const text = await res.text().catch(() => "");
      if (!res.ok || !netgsmAccepted(text)) {
        throw new SmsSendError("SMS_PROVIDER_REJECTED");
      }
    },
  };
}

function twilioProvider(env: NodeJS.ProcessEnv): SmsProvider | null {
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_FROM?.trim();
  const service = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!sid || !token || (!from && !service)) return null;
  return {
    name: "twilio",
    async sendOtp({ phoneNorm, code }) {
      const form = new URLSearchParams({
        To: `+90${phoneNorm}`,
        Body: otpMessage(code),
      });
      if (service) form.set("MessagingServiceSid", service);
      else if (from) form.set("From", from);
      let res: Response;
      try {
        res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          },
        );
      } catch {
        throw new SmsSendError("SMS_NETWORK");
      }
      if (!res.ok) throw new SmsSendError("SMS_PROVIDER_REJECTED");
    },
  };
}

export function resolveSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const prod = env.NODE_ENV === "production";
  const choice = (env.SMS_PROVIDER || (prod ? "" : "dev")).trim().toLowerCase();
  if (choice === "netgsm") return netgsmProvider(env) ?? unconfiguredProvider;
  if (choice === "twilio") return twilioProvider(env) ?? unconfiguredProvider;
  if (choice === "dev" && !prod) return devProvider;
  return unconfiguredProvider;
}

export function getSmsProvider() {
  return resolveSmsProvider(process.env);
}

export function smsDeliveryAvailable() {
  return getSmsProvider().name !== "none";
}

/** Only the dev provider may echo codes back (to the dev UI). Never in production. */
export function isDevSmsInbox() {
  return !isProd() && getSmsProvider().name === "dev";
}
