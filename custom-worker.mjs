// Cloudflare entry point: the OpenNext worker plus a short edge cache for the
// few pages that are the same for every visitor. The home page is the busiest
// and heaviest page to render; without this every visit (and every crawler
// hit) renders it from scratch. Votes still update live in the browser, so a
// copy up to a minute old only changes what shows before the page connects.
import openNext from "./.open-next/worker.js";

/** Path -> seconds an edge copy may be served. Pages here must not depend on who is asking. */
const SHARED_PAGES = new Map([
  ["/", 60],
  ["/sitemap.xml", 3600],
  ["/llms.txt", 600],
]);

const NO_STORE = "private, no-cache, no-store, max-age=0, must-revalidate";

function cacheable(request, url) {
  return (
    request.method === "GET" &&
    SHARED_PAGES.has(url.pathname) &&
    // Query strings and in-app navigations (RSC payloads) go straight to Next.
    url.search === "" &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch")
  );
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!cacheable(request, url)) return openNext.fetch(request, env, ctx);

    const cache = caches.default;
    const key = new Request(`${url.origin}${url.pathname}`);
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      // Browsers always come back to the edge; only the edge keeps a copy.
      res.headers.set("Cache-Control", NO_STORE);
      res.headers.set("X-Edge-Cache", "HIT");
      return res;
    }

    const response = await openNext.fetch(request, env, ctx);
    if (response.status === 200 && !response.headers.has("set-cookie")) {
      const stored = new Response(response.clone().body, response);
      stored.headers.set("Cache-Control", `public, s-maxage=${SHARED_PAGES.get(url.pathname)}`);
      ctx.waitUntil(cache.put(key, stored));
    }
    const res = new Response(response.body, response);
    res.headers.set("X-Edge-Cache", "MISS");
    return res;
  },
};

export default worker;
