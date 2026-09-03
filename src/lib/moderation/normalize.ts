const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD\u2060]/g;
const WHITESPACE = /\s+/g;
const REPEAT_3 = /(.)\1{2,}/g;
const NON_ALNUM = /[^a-z0-9]+/g;

/** Common lookalikes used to evade filters. Not a word list. */
const HOMOGLYPH: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ѕ: "s",
  ԁ: "d",
  ɡ: "g",
  α: "a",
  ε: "e",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "y",
  χ: "x",
  ι: "i",
  ν: "v",
  η: "n",
  κ: "k",
  "ß": "ss",
};

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function mapChars(input: string, table: Record<string, string>) {
  let out = "";
  for (const ch of input) {
    out += table[ch] ?? ch;
  }
  return out;
}

export type NormalizedForumContent = {
  /** Original text is never mutated; this is matching-only. */
  normalized: string;
  compact: string;
  aggressive: string;
  longestRepeat: number;
};

export function normalizeForumContent(raw: string): NormalizedForumContent {
  const nfkc = raw.normalize("NFKC").replace(ZERO_WIDTH, "");
  let longestRepeat = 1;
  let run = 1;
  for (let i = 1; i < nfkc.length; i++) {
    if (nfkc[i] === nfkc[i - 1]) {
      run += 1;
      if (run > longestRepeat) longestRepeat = run;
    } else {
      run = 1;
    }
  }

  const folded = nfkc
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase();
  const spaced = folded.replace(WHITESPACE, " ").trim();
  const glyphs = mapChars(mapChars(spaced, HOMOGLYPH), LEET);
  const normalized = glyphs.replace(REPEAT_3, "$1$1");
  const compact = normalized.replace(NON_ALNUM, "");
  const aggressive = compact.replace(/(.)\1+/g, "$1");

  return { normalized, compact, aggressive, longestRepeat };
}
