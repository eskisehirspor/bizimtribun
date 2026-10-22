import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Share images (Open Graph / X). Rendered per request from live counts and
 * always stamped with the time the numbers were read, so an old screenshot
 * can't pass as current. Fonts are OFL files in assets/fonts.
 */
export const OG_SIZE = { width: 1200, height: 630 };

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> | null = null;

/**
 * On Cloudflare Workers there is no file system: the same font files are
 * published under /fonts and read through the static-assets binding.
 * Locally (next dev / next start) they come from assets/fonts.
 */
async function fontFile(name: string): Promise<ArrayBuffer> {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as unknown as { ASSETS: { fetch(url: string): Promise<Response> } }).ASSETS;
    const res = await assets.fetch(`https://assets.local/fonts/${name}`);
    if (!res.ok) throw new Error(`font ${name}: ${res.status}`);
    return res.arrayBuffer();
  }
  const buf = await readFile(join(process.cwd(), "assets/fonts", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function loadFonts() {
  fonts ??= Promise.all([fontFile("Anton-Regular.ttf"), fontFile("SpaceMono-Bold.ttf")]).then(([anton, mono]) => [
    { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
    { name: "Space Mono", data: mono, weight: 700 as const, style: "normal" as const },
  ]).catch((err) => {
    fonts = null; // try again on the next request
    throw err;
  });
  return fonts;
}

export function ogStamp(date = new Date()) {
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export type ShareCard = {
  eyebrow: string;
  title: string;
  stat?: string;
  statLabel?: string;
  lines?: string[];
  /** Background / accent of the left band (team colours when there is a team). */
  band?: [string, string];
  generatedAt?: Date;
  /** False for the fixed site card, which shows no live numbers. */
  stamp?: boolean;
};

export async function renderShareCard(card: ShareCard) {
  const [a, b] = card.band ?? ["#111111", "#FFEA00"];
  const titleSize = card.title.length > 22 ? 84 : card.title.length > 14 ? 104 : 128;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F2EFE6", fontFamily: "Space Mono" }}>
        <div style={{ width: 56, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, background: a }} />
          <div style={{ flex: 1, background: b }} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "44px 56px",
            borderLeft: "8px solid #000",
          }}
        >
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4 }}>{card.eyebrow.toLocaleUpperCase("tr")}</div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: titleSize,
              lineHeight: 0.95,
              marginTop: 18,
              textTransform: "uppercase",
            }}
          >
            {card.title.toLocaleUpperCase("tr")}
          </div>
          {card.stat != null && (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 26 }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Anton",
                  fontSize: 96,
                  lineHeight: 1,
                  background: "#FFEA00",
                  border: "6px solid #000",
                  padding: "6px 22px",
                }}
              >
                {card.stat}
              </div>
              {card.statLabel && (
                <div style={{ display: "flex", fontSize: 28, marginLeft: 22, marginBottom: 12 }}>{card.statLabel}</div>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 26, gap: 6 }}>
            {(card.lines ?? []).slice(0, 3).map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}>
            <div style={{ display: "flex", fontFamily: "Anton", fontSize: 40 }}>BİZİM TRİBÜN</div>
            {card.stamp === false ? (
              <div style={{ display: "flex", alignSelf: "flex-end" }}>bizimtribun.com</div>
            ) : (
              <div style={{ display: "flex", alignSelf: "flex-end" }}>VERİ: {ogStamp(card.generatedAt)}</div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}

/**
 * Renders a live card, or sends crawlers to the fixed site card when drawing
 * fails, so a shared link never shows an empty image box. The image is fully
 * rendered here because ImageResponse only fails once its body is read.
 */
export async function shareCardOrFallback(draw: () => Promise<Response>) {
  try {
    const img = await draw();
    const body = await img.arrayBuffer();
    return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("share card failed", err);
    return Response.redirect(`${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/og.png`, 302);
  }
}
