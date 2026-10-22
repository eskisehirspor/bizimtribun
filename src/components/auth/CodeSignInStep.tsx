"use client";

import { useEffect, useState } from "react";
import EmailOtpStep from "./EmailOtpStep";
import PhoneOtpStep from "./PhoneOtpStep";

export type VerifyChannel = "email" | "sms";

/** Asks the server which channel sign-in uses (VERIFY_CHANNEL); e-mail until it answers. */
export function useVerifyChannel(): VerifyChannel {
  const [channel, setChannel] = useState<VerifyChannel>("email");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/otp/request", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && (d.channel === "sms" || d.channel === "email")) setChannel(d.channel);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return channel;
}

type Props = {
  channel: VerifyChannel;
  onVerified: (data: Record<string, unknown>) => void;
  submitLabel?: string;
  /** On the sign-up page an address that already has an account is told so instead of getting a code. */
  forSignup?: boolean;
};

/** Sign-in / sign-up code step on the active channel. */
export default function CodeSignInStep({ channel, onVerified, submitLabel, forSignup }: Props) {
  const Step = channel === "sms" ? PhoneOtpStep : EmailOtpStep;
  return (
    <Step
      key={channel}
      requestUrl={forSignup ? "/api/auth/otp/request?amac=kayit" : "/api/auth/otp/request"}
      verifyUrl="/api/auth/otp/verify"
      submitLabel={submitLabel}
      onVerified={onVerified}
    />
  );
}
