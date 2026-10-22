// Draws public/og.png, the fixed share card used when a link to the site is
// posted on X, WhatsApp, Facebook etc. Run after a design change:
// npx tsx scripts/share-card.tsx
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderShareCard } from "../src/lib/og-card";

(async () => {
  const img = await renderShareCard({
    eyebrow: "Türkiye taraftar sayımı",
    title: "En büyük kim?",
    lines: ["Hangi takımın kaç taraftarı var?", "Doğrulanmış hesap, tek ve kalıcı oy.", "81 il, gerçek sayı."],
    stamp: false,
  });
  writeFileSync(join(__dirname, "../public/og.png"), Buffer.from(await img.arrayBuffer()));
})();
