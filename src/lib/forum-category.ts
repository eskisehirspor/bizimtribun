/** The fixed sub-forums of every tribune, in display order. */
export const FORUM_CATEGORIES = [
  "genel-sohbet",
  "mac-gundemi",
  "kadro-oyuncular",
  "teknik-direktor-taktik",
  "kulup-yonetimi",
  "altyapi",
  "tribun-kulturu",
  "deplasman",
  "kulup-tarihi",
  "haberler-duyurular",
] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export const FORUM_CATEGORY_DEFAULT: ForumCategory = "genel-sohbet";

export const FORUM_CATEGORY_META: Record<
  ForumCategory,
  { label: string; tab: string; blurb: string }
> = {
  "genel-sohbet": {
    label: "Genel Sohbet",
    tab: "GENEL SOHBET",
    blurb: "Takımla ilgili genel konuşmalar, taraftar görüşleri ve gündem.",
  },
  "mac-gundemi": {
    label: "Maç Gündemi",
    tab: "MAÇ GÜNDEMİ",
    blurb: "Maç öncesi değerlendirmeler, maç sırasındaki yorumlar ve maç sonu tartışmaları.",
  },
  "kadro-oyuncular": {
    label: "Takım Kadrosu ve Oyuncular",
    tab: "KADRO VE OYUNCULAR",
    blurb: "Futbolcu performansları, ilk 11, oyuncu değerlendirmeleri.",
  },
  "teknik-direktor-taktik": {
    label: "Teknik Direktör ve Taktik",
    tab: "TEKNİK DİREKTÖR VE TAKTİK",
    blurb: "Oyun sistemi, takım dizilişi, teknik direktör kararları.",
  },
  "kulup-yonetimi": {
    label: "Kulüp Yönetimi",
    tab: "KULÜP YÖNETİMİ",
    blurb: "Yönetim kararları, kulübün hedefleri, mali durum ve kurumsal gelişmeler.",
  },
  altyapi: {
    label: "Altyapı ve Genç Yetenekler",
    tab: "ALTYAPI VE GENÇLER",
    blurb: "Akademi, genç futbolcular ve geleceğin oyuncuları.",
  },
  "tribun-kulturu": {
    label: "Tribün ve Taraftar Kültürü",
    tab: "TRİBÜN KÜLTÜRÜ",
    blurb: "Tribün grupları, tezahüratlar, taraftar gelenekleri ve atmosfer.",
  },
  deplasman: {
    label: "Deplasman ve Organizasyon",
    tab: "DEPLASMAN",
    blurb: "Deplasman yolculukları, taraftar buluşmaları ve maç organizasyonları.",
  },
  "kulup-tarihi": {
    label: "Kulüp Tarihi ve Efsaneler",
    tab: "TARİH VE EFSANELER",
    blurb: "Unutulmaz maçlar, eski futbolcular, tarihî başarılar ve anılar.",
  },
  "haberler-duyurular": {
    label: "Kulüp Haberleri ve Duyurular",
    tab: "HABERLER VE DUYURULAR",
    blurb: "Resmî açıklamalar, sakatlık haberleri, kulüp duyuruları ve önemli gelişmeler.",
  },
};

/** Categories before the fixed list, and where their topics moved (migration 013). */
export const LEGACY_FORUM_CATEGORIES: Record<string, ForumCategory> = {
  gundem: "genel-sohbet",
  tartisma: "genel-sohbet",
  "mac-gunu": "mac-gundemi",
  anilar: "kulup-tarihi",
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

/** GET: missing → no filter. Old category links map to their new one. Invalid → null. */
export function parseForumCategoryParam(raw: string | null) {
  if (raw == null || raw === "") return { ok: true as const, category: null };
  if (LEGACY_FORUM_CATEGORIES[raw]) return { ok: true as const, category: LEGACY_FORUM_CATEGORIES[raw] };
  if (!isForumCategory(raw)) return { ok: false as const };
  return { ok: true as const, category: raw };
}

/** POST: missing uses the fallback. Invalid → null. */
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
