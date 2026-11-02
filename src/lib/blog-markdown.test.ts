import assert from "node:assert/strict";
import { test } from "node:test";
import { type Inline, inlineText, parseInline, parseMarkdown, safeHref, slugify, wordCount } from "./blog-markdown";

test("slugify folds Turkish letters", () => {
  assert.equal(slugify("İstanbul'da Çok Güçlü Şampiyon Ödülü"), "istanbul-da-cok-guclu-sampiyon-odulu");
  assert.equal(slugify("Anketler ne diyor?"), "anketler-ne-diyor");
});

test("links: site paths and https only", () => {
  assert.equal(safeHref("/il/eskisehir"), "/il/eskisehir");
  assert.equal(safeHref("https://konda.com.tr/rapor"), "https://konda.com.tr/rapor");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("//evil.example"), null);
  assert.equal(safeHref("http://plain.example"), null);
  const unsafe = parseInline("[tıkla](javascript:alert(1))");
  assert.ok(unsafe.every((n) => n.type !== "link"));
});

test("inline bold, italic and links nest", () => {
  const nodes = parseInline("**Kalın [bağlantı](/takimlar)** ve *eğik* yazı");
  assert.equal(nodes[0].type, "strong");
  assert.equal(inlineText(nodes), "Kalın bağlantı ve eğik yazı");
  const strong = nodes[0] as Extract<(typeof nodes)[number], { type: "strong" }>;
  assert.equal(strong.children[1].type, "link");
});

test("blocks: headings, lists, quote, table, paragraphs", () => {
  const blocks = parseMarkdown(`
Giriş satırı bir
devamı.

## Başlık
### Alt başlık
## Başlık

- bir
- iki

1. ilk
2. ikinci

> alıntı
> sürüyor

| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |
`);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["paragraph", "heading", "heading", "heading", "list", "list", "quote", "table"],
  );
  assert.equal(inlineText((blocks[0] as { children: Inline[] }).children), "Giriş satırı bir devamı.");
  const ids = blocks.filter((b) => b.type === "heading").map((b) => (b as { id: string }).id);
  assert.deepEqual(ids, ["baslik", "alt-baslik", "baslik-2"]);
  const [bullets, numbers] = blocks.filter((b) => b.type === "list") as { ordered: boolean; items: unknown[] }[];
  assert.equal(bullets.ordered, false);
  assert.equal(numbers.ordered, true);
  assert.equal(numbers.items.length, 2);
  const table = blocks[7] as { head: unknown[]; rows: unknown[][] };
  assert.equal(table.head.length, 2);
  assert.equal(table.rows.length, 2);
});

test("word count ignores markup", () => {
  assert.equal(wordCount("## İki kelime\n\n**bir** [iki](/x) üç"), 5);
});
