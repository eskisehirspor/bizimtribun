/**
 * The small Markdown subset blog posts are written in, parsed to a plain tree
 * that React renders (no HTML strings, so nothing in a post can inject markup).
 *
 * Blocks: "## " and "### " headings, paragraphs, "- " and "1. " lists,
 * "> " quotes, pipe tables (header row, then a |---| row). Inline: **bold**,
 * *italic*, [text](url). Anything else is kept as text.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] };

const TR_FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u" };

/** "Anketler ne diyor?" → "anketler-ne-diyor", for heading anchors. */
export function slugify(text: string) {
  return text
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (ch) => TR_FOLD[ch.toLocaleLowerCase("tr")] ?? TR_FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Only site paths, in-page anchors and https links; anything else stays plain text. */
export function safeHref(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  if (/^https:\/\/[^\s]+$/.test(href)) return href;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ type: "text", text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (src[i] === "*" && src[i + 1] !== "*") {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1 && src[end + 1] !== "*") {
        flush();
        out.push({ type: "em", children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (src[i] === "[") {
      const close = src.indexOf("](", i + 1);
      const end = close === -1 ? -1 : src.indexOf(")", close + 2);
      if (close > i + 1 && end > close + 2) {
        const href = safeHref(src.slice(close + 2, end).trim());
        const label = parseInline(src.slice(i + 1, close));
        flush();
        if (href) out.push({ type: "link", href, children: label });
        else out.push(...label);
        i = end + 1;
        continue;
      }
    }
    text += src[i];
    i += 1;
  }
  flush();
  return out;
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

const isTableRule = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const usedIds = new Map<string, number>();
  let i = 0;

  const uniqueId = (text: string) => {
    const base = slugify(text) || "bolum";
    const seen = usedIds.get(base) ?? 0;
    usedIds.set(base, seen + 1);
    return seen ? `${base}-${seen + 1}` : base;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({
        type: "heading",
        level: heading[1].length as 2 | 3,
        id: uniqueId(text),
        children: parseInline(text),
      });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      const head = splitRow(trimmed).map(parseInline);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(parts.join(" ")) });
      continue;
    }

    const bullet = /^[-*]\s+/;
    const numbered = /^\d+[.)]\s+/;
    if (bullet.test(trimmed) || numbered.test(trimmed)) {
      const ordered = numbered.test(trimmed);
      const marker = ordered ? numbered : bullet;
      const items: Inline[][] = [];
      while (i < lines.length && marker.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(marker, "")));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const parts: string[] = [];
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || /^#{2,3}\s/.test(next) || next.startsWith(">") || bullet.test(next) || numbered.test(next)) break;
      if (next.startsWith("|") && i + 1 < lines.length && isTableRule(lines[i + 1])) break;
      parts.push(next);
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(parts.join(" ")) });
  }
  return blocks;
}

export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : inlineText(n.children))).join("");
}

/** Plain words of a post, for reading time. */
export function wordCount(src: string) {
  return parseMarkdown(src)
    .flatMap((b) => {
      if (b.type === "list") return b.items.map(inlineText);
      if (b.type === "table") return [...b.head, ...b.rows.flat()].map(inlineText);
      return [inlineText(b.children)];
    })
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}
