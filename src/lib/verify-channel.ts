/**
 * How new members prove they are real: an e-mail code (default) or an SMS
 * code. VERIFY_CHANNEL=sms switches sign-up and code sign-in back to SMS once
 * an SMS provider with an approved sender name is set up. Accounts verified
 * either way keep working after a switch.
 */
export type VerifyChannel = "email" | "sms";

export function verifyChannel(env: NodeJS.ProcessEnv = process.env): VerifyChannel {
  return env.VERIFY_CHANNEL?.trim().toLowerCase() === "sms" ? "sms" : "email";
}
