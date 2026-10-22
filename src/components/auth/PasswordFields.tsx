"use client";

import { hintClass, labelClass } from "@/components/ui";
import { inputClass } from "@/components/auth/ui";
import { isStrongPassword, PASSWORD_RULE_LABELS, passwordChecks } from "@/lib/password-rules";

/** New password + repeat, with the rules ticking off as the member types. */
export default function PasswordFields({
  password,
  repeat,
  onPassword,
  onRepeat,
  label = "ŞİFRE",
}: {
  password: string;
  repeat: string;
  onPassword: (v: string) => void;
  onRepeat: (v: string) => void;
  label?: string;
}) {
  const checks = passwordChecks(password);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={labelClass}>{label}</span>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          className={inputClass}
          autoComplete="new-password"
          maxLength={128}
        />
      </label>
      <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 font-mono text-[12px]" aria-label="Şifre kuralları">
        {PASSWORD_RULE_LABELS.map((r) => (
          <li key={r.key} className={checks[r.key] ? "" : "opacity-50"}>
            {checks[r.key] ? "✓" : "○"} {r.label}
          </li>
        ))}
      </ul>
      <label className="block">
        <span className={labelClass}>ŞİFRE (TEKRAR)</span>
        <input
          required
          type="password"
          value={repeat}
          onChange={(e) => onRepeat(e.target.value)}
          className={inputClass}
          autoComplete="new-password"
          maxLength={128}
        />
      </label>
      {repeat && repeat !== password && <p className={hintClass}>İki şifre aynı değil.</p>}
    </div>
  );
}

export function passwordReady(password: string, repeat: string) {
  return isStrongPassword(password) && password === repeat;
}
