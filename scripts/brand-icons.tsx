// Draws the site icons (favicon, app icons, search-result logo) from the brand font.
// Run once after a design change: npx tsx scripts/brand-icons.tsx
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const root = join(__dirname, "..");
const anton = readFileSync(join(root, "assets/fonts/Anton-Regular.ttf"));

async function render(size: number) {
  const border = Math.max(1, Math.round(size * 0.06));
  const img = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111111" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFEA00",
            margin: border,
            fontFamily: "Anton",
            fontSize: size * 0.56,
            lineHeight: 1,
            color: "#111111",
            letterSpacing: -size * 0.01,
            paddingBottom: size * 0.02,
          }}
        >
          BT
        </div>
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Anton", data: anton, weight: 400, style: "normal" }] },
  );
  return Buffer.from(await img.arrayBuffer());
}

/** .ico holding PNG images, which every current browser reads. */
function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size, at);
    header.writeUInt8(size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

(async () => {
  const out = (path: string, data: Buffer) => writeFileSync(join(root, path), data);
  const big = await render(512);
  out("src/app/icon.png", big);
  out("public/logo.png", big);
  out("src/app/apple-icon.png", await render(180));
  out("public/icon-192.png", await render(192));
  out("src/app/favicon.ico", ico([{ size: 16, png: await render(16) }, { size: 32, png: await render(32) }]));
})();
