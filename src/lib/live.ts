/**
 * Live vote counts. When a vote is cast, voided or restored the server sends
 * a "votes changed" signal on a public Supabase Realtime channel; open pages
 * hear it and fetch /api/stats again. The signal carries no data, so nothing
 * private ever goes through Realtime.
 */
export const LIVE_VOTES_CHANNEL = "tribun-oylar";
export const LIVE_VOTES_EVENT = "degisti";

function realtimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : undefined;
}

async function keepAlive(promise: Promise<unknown>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(promise);
  } catch {
    // Not on Workers: the promise runs on by itself.
  }
}

/** Fire and forget: counts never wait on Realtime, and a lost signal is harmless. */
export function announceVoteChange() {
  const config = realtimeConfig();
  if (!config || process.env.BIZIM_TRIBUN_TEST === "1") return;
  const send = fetch(`${config.url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ topic: LIVE_VOTES_CHANNEL, event: LIVE_VOTES_EVENT, payload: {}, private: false }],
    }),
  }).catch(() => undefined);
  void keepAlive(send);
}
