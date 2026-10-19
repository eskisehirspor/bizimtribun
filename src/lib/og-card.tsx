import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Share images (Open Graph / X). Rendered per request from live counts and
 * always stamped with the time the numbers were read, so an old screenshot
 * can't pass as current. Fonts are OFL files in assets/fonts.
 */
export const OG_SIZE = { width: 1200, height: 630 };

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;

function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/SpaceMono-Bold.ttf")),
  ]).then(([anton, mono]) => [
    { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
    { name: "Space Mono", data: mono, weight: 700 as const, style: "normal" as const },
  ]);
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
            <div style={{ display: "flex", alignSelf: "flex-end" }}>VERİ: {ogStamp(card.generatedAt)}</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
