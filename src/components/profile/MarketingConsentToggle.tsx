"use client";

import { useEffect, useState } from "react";
import { errorText, Notice, postJson } from "@/components/auth/ui";

/** Optional campaign-SMS consent; withdrawing is as easy as giving it. */
export default function MarketingConsentToggle() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/marketing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.consent === "boolean") setConsent(d.consent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(next: boolean) {
    setError(null);
    const r = await postJson("/api/account/marketing", { consent: next });
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    setConsent(next);
  }

  return (
    <div className="space-y-2">
      <label className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
        <input
          type="checkbox"
          disabled={consent === null}
          checked={Boolean(consent)}
          onChange={(e) => void change(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>Bizim Tribün&apos;e özel fırsat ve kampanyalardan SMS ile haberdar olmak istiyorum.</span>
      </label>
      <p className="font-mono text-[12px] opacity-70">İstediğin zaman bu kutuyu kaldırarak izni geri alabilirsin.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
