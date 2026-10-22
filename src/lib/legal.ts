import type { Db } from "./db";
import {
  COOKIE_POLICY_VERSION,
  LEGAL_RECORD_AFTER_DELETE_MS,
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
} from "./policy";

/**
 * Data controller details shown in the legal texts, as given by the owner.
 * Bracketed values are still open and must be filled before launch.
 */
export const LEGAL_ENTITY = {
  name: "ASD TASARIM BİLİŞİM REKLAM MATBAA SANAYİ TİCARET LİMİTED ŞİRKETİ",
  address: "Osmangazi Mah. Basın Şehitleri Cad. No:174/1 Odunpazarı/ESKİŞEHİR",
  mersis: "0086044349300012",
  taxNo: "0860443493",
  email: "kvkk@asd.web.tr",
  kep: "asdtasarim@hs01.kep.tr",
  verbis: "Veri sorumlusu henüz VERBİS’e kayıtlı değildir.",
  court: "Eskişehir Mahkemeleri ve İcra Daireleri",
} as const;

export type LegalDocId = "terms" | "privacy";

export const LEGAL_DOCS: Record<LegalDocId, { version: string; title: string; path: string; label: string }> = {
  terms: {
    version: TERMS_VERSION,
    title: "Kullanım Koşulları",
    path: "/kullanim-kosullari",
    label: "Kullanım Koşulları'nı okudum ve kabul ediyorum.",
  },
  privacy: {
    version: PRIVACY_NOTICE_VERSION,
    title: "KVKK Aydınlatma Metni",
    path: "/kvkk",
    label: "KVKK Aydınlatma Metni'ni okudum, kişisel verilerimin nasıl işlendiği konusunda bilgilendirildim.",
  },
};

export const COOKIE_POLICY = { version: COOKIE_POLICY_VERSION, title: "Çerez Politikası", path: "/cerez-politikasi" };

export const LEGAL_DOC_IDS = Object.keys(LEGAL_DOCS) as LegalDocId[];

export type PendingLegalDoc = { doc: LegalDocId; version: string; title: string; path: string; label: string };

/** Current texts this member has not accepted (or acknowledged) yet. */
export async function pendingLegalDocs(db: Db, userId: number): Promise<PendingLegalDoc[]> {
  const done = new Set(
    (
      await db
                  .prepare(`SELECT doc, version FROM legal_acceptances WHERE user_id = ?`)
                  .all(userId) as { doc: string; version: string }[]
    ).map((r) => `${r.doc}:${r.version}`),
  );
  return LEGAL_DOC_IDS.filter((doc) => !done.has(`${doc}:${LEGAL_DOCS[doc].version}`)).map((doc) => ({
    doc,
    ...LEGAL_DOCS[doc],
  }));
}

/**
 * Records acceptance of the given texts at their current versions. Callers
 * pass only what the member explicitly ticked; a stale version is refused so
 * nobody "accepts" a text they were not shown.
 */
export async function recordLegalAcceptance(
  db: Db,
  input: { userId: number; accepted: { doc: string; version: string }[]; source: "signup" | "reaccept"; at?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const at = input.at ?? new Date().toISOString();
  for (const item of input.accepted) {
    const current = LEGAL_DOCS[item.doc as LegalDocId];
    if (!current) return { ok: false, error: "Bilinmeyen metin." };
    if (current.version !== item.version) {
      return { ok: false, error: `${current.title} güncellendi. Sayfayı yenileyip yeni metni oku.` };
    }
  }
  const insert = db.prepare(
    `INSERT INTO legal_acceptances (user_id, doc, version, accepted_at, source) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  for (const item of input.accepted) await insert.run(input.userId, item.doc, item.version, at, input.source);
  if (input.accepted.some((a) => a.doc === "terms")) {
    await db.prepare(`UPDATE users SET terms_version = ?, terms_accepted_at = ? WHERE id = ?`).run(
            LEGAL_DOCS.terms.version,
            at,
            input.userId,
          );
  }
  return { ok: true };
}

/** Drops acceptance records of accounts deleted more than ten years ago. */
export async function purgeOldLegalRecords(db: Db, now = Date.now()) {
  const cutoff = new Date(now - LEGAL_RECORD_AFTER_DELETE_MS).toISOString();
  return (await db
      .prepare(
        `DELETE FROM legal_acceptances
       WHERE user_id IN (SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?)`,
      )
      .run(cutoff)).changes;
}

export const LEGAL_PENDING_ERROR =
  "Kullanım Koşulları veya Aydınlatma Metni güncellendi. Devam etmek için yeni metinleri onayla.";
