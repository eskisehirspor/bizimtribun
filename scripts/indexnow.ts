// Tells Bing (and through it ChatGPT/Copilot search), Yandex and the other
// IndexNow engines about every URL in the live sitemap. Run after a deploy
// that changes public pages: npm run seo:indexnow
// The key must match public/<key>.txt, which proves we own the site.
const KEY = "bbecf5795aa00831bc5942fa8858ec64";
const site = (process.env.APP_URL || "https://bizimtribun.com").replace(/\/$/, "");

(async () => {
  const xml = await (await fetch(`${site}/sitemap.xml`)).text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urlList.length === 0) throw new Error("sitemap has no URLs");
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(site).host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
  });
  // 200 and 202 both mean accepted.
  console.log(`indexnow ${res.status} for ${urlList.length} URLs`);
  if (res.status >= 300) process.exit(1);
})();
