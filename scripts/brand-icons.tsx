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

/** Classic 32-bit BMP icon entry; Safari shows these more reliably than PNG-in-ICO. */
async function bmp(png: Buffer, size: number) {
  const { default: sharp } = await import("sharp");
  const rgba = await sharp(png).ensureAlpha().raw().toBuffer();
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = ((size - 1 - y) * size + x) * 4;
      const to = (y * size + x) * 4;
      pixels[to] = rgba[from + 2];
      pixels[to + 1] = rgba[from + 1];
      pixels[to + 2] = rgba[from];
      pixels[to + 3] = rgba[from + 3];
    }
  }
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  return Buffer.concat([header, pixels, mask]);
}

function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size, at);
    header.writeUInt8(size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

(async () => {
  const out = (path: string, data: Buffer) => writeFileSync(join(root, path), data);
  const big = await render(512);
  out("src/app/icon1.png", await render(32));
  out("src/app/icon2.png", big);
  out("public/logo.png", big);
  out("src/app/apple-icon.png", await render(180));
  out("public/icon-192.png", await render(192));
  const entries = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, data: await bmp(await render(size), size) })),
  );
  out("src/app/favicon.ico", ico(entries));
})();
