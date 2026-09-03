export const FORUM_CATEGORIES = [
  "gundem",
  "deplasman",
  "tartisma",
  "anilar",
] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export const FORUM_CATEGORY_DEFAULT: ForumCategory = "gundem";

export const FORUM_CATEGORY_META: Record<
  ForumCategory,
  { label: string; tab: string; blurb: string }
> = {
  gundem: {
    label: "Gündem",
    tab: "GÜNDEM",
    blurb: "Maç, transfer, oyuncu, teknik direktör, takım haberleri.",
  },
  deplasman: {
    label: "Deplasman",
    tab: "DEPLASMAN",
    blurb: "Yolculuk, bilet, ulaşım, buluşma, organizasyon.",
  },
  tartisma: {
    label: "Tartışma",
    tab: "TARTIŞMA",
    blurb: "Rakiple sportif rekabet. Küfür, nefret ve siyaset yok.",
  },
  anilar: {
    label: "Anılar",
    tab: "ANILAR",
    blurb: "İlk maç, tribün hatırası, aileden gelen sevgi.",
  },
};

export const PINNED_STARTER_TOPICS = [
  {
    title: "İlk gittiğin maç hangisiydi?",
    content:
      "İlk stadyum, ilk skor, ilk tezahürat. Anını tribüne yaz.",
  },
  {
    title: "Seni ilk kim bu takımlı yaptı?",
    content:
      "Baba, anne, abi, mahalle, bir maç. Takımı sana kim aşıladı?",
  },
  {
    title: "Tribünde unutamadığın an ne?",
    content:
      "Gol, korenin durduğu an, otobüs, yağmur. Unutamadığın sahne.",
  },
] as const;

export function tribunTitle(teamName: string) {
  return `${teamName} Tribünü`;
}

export function isForumCategory(value: unknown): value is ForumCategory {
  return (
    typeof value === "string" &&
    (FORUM_CATEGORIES as readonly string[]).includes(value)
  );
}

/** GET: missing → no filter. Invalid → null. */
export function parseForumCategoryParam(raw: string | null) {
  if (raw == null || raw === "") return { ok: true as const, category: null };
  if (!isForumCategory(raw)) return { ok: false as const };
  return { ok: true as const, category: raw };
}

/** POST/PUT: missing uses defaultGundem on create. Invalid → null. */
export function parseForumCategoryInput(
  raw: unknown,
  fallback: ForumCategory | null,
) {
  if (raw == null || raw === "") {
    return fallback == null
      ? { ok: true as const, category: null }
      : { ok: true as const, category: fallback };
  }
  if (!isForumCategory(raw)) return { ok: false as const };
  return { ok: true as const, category: raw };
}

export type TopicSort = "activity" | "newest";

export function parseTopicSort(raw: string | null): TopicSort {
  return raw === "newest" ? "newest" : "activity";
}

export function topicOrderSql(sort: TopicSort) {
  const time = sort === "newest" ? "t.created_at DESC" : "t.updated_at DESC";
  return `t.is_pinned DESC, ${time}`;
}

export function sortTopicsForBoard<
  T extends { isPinned?: boolean; createdAt: string; updatedAt: string },
>(rows: T[], sort: TopicSort) {
  const copy = [...rows];
  copy.sort((a, b) => {
    const pin = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pin) return pin;
    const key = sort === "newest" ? "createdAt" : "updatedAt";
    return b[key].localeCompare(a[key]);
  });
  return copy;
}
