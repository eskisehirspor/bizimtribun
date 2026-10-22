"use client";

import { useEffect, useRef } from "react";
import { LIVE_VOTES_CHANNEL, LIVE_VOTES_EVENT } from "@/lib/live";

// A burst of votes becomes one refresh; it also lets the vote's transaction
// finish before the page asks for new numbers.
const SETTLE_MS = 1500;
// Without Realtime (or if it drops), the numbers still refresh now and then.
const FALLBACK_POLL_MS = 60_000;

/** Calls `onChange` whenever the vote counts change, while the page is open. */
export function useLiveVotes(onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;
    let stopped = false;

    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState === "visible") latest.current();
      }, SETTLE_MS);
    };

    const poll = setInterval(schedule, FALLBACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      void import("@supabase/supabase-js").then(({ createClient }) => {
        if (stopped) return;
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const channel = client
          .channel(LIVE_VOTES_CHANNEL)
          .on("broadcast", { event: LIVE_VOTES_EVENT }, schedule)
          .subscribe();
        cleanup = () => {
          void client.removeChannel(channel);
        };
      });
    }

    return () => {
      stopped = true;
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      cleanup?.();
    };
  }, []);
}
