import type Database from "better-sqlite3";
import { PROVINCES } from "./provinces";
import { getTeam } from "./teams";
import { identityEmailHash, identityPhoneHash } from "./crypto";
import { CONSENT_VERSION, CURRENT_POLL_ID } from "./policy";

export const SEED_DOMAIN = "bizimtribun.demo";
const SEED_VERSION = "v4";
const SEED_EMAIL_LIKE = `seed.%@${SEED_DOMAIN}`;
const SEED_DOMAIN_LIKE = `%@${SEED_DOMAIN}`;

/** Local/dev only. Production (NODE_ENV=production) never seeds. */
export function isDemoRuntime() {
  return process.env.NODE_ENV !== "production";
}

export function stripDemoVotes(db: Database.Database) {
  db.prepare(
    `DELETE FROM votes WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(
    `DELETE FROM phone_otps WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(
    `DELETE FROM verify_tokens WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(`DELETE FROM participants WHERE email_norm LIKE ?`).run(
    SEED_DOMAIN_LIKE,
  );
}

function votes(
  city: string,
  teamId: string,
  n: number,
): [city: string, teamId: string][] {
  return Array.from({ length: n }, () => [city, teamId]);
}

/** Yerel ağırlığı yüksek iller + ülke genelinde GS / FB (tek tük BJK). */
export const DEMO_VOTES: [city: string, teamId: string][] = [
  ...votes("Eskişehir", "eskisehirspor", 5),
  ...votes("İzmir", "goztepe", 5),
  ...votes("Bursa", "bursaspor", 5),
  ...votes("Kocaeli", "kocaelispor", 3),
  ...votes("Sakarya", "sakaryaspor", 3),
  ...votes("Trabzon", "trabzonspor", 6),
  ...votes("Kayseri", "kayserispor", 3),
  ...votes("Ankara", "genclerbirligi", 4),
  ...votes("Konya", "konyaspor", 3),

  ...votes("İstanbul", "galatasaray", 11),
  ...votes("İstanbul", "fenerbahce", 7),
  ...votes("İstanbul", "besiktas", 3),

  ...votes("Adana", "adana-demirspor", 2),
  ...votes("Afyonkarahisar", "afyonspor", 1),
  ...votes("Amasya", "galatasaray", 1),
  ...votes("Bingöl", "galatasaray", 1),
  ...votes("Çorum", "corum-fk", 1),
  ...votes("Diyarbakır", "amed-sfk", 2),
  ...votes("Elazığ", "elazigspor", 1),
  ...votes("Erzincan", "galatasaray", 1),
  ...votes("Gaziantep", "gaziantep-fk", 2),
  ...votes("Giresun", "giresunspor", 1),
  ...votes("Kars", "galatasaray", 1),
  ...votes("Kütahya", "kutahyaspor", 1),
  ...votes("Malatya", "yeni-malatyaspor", 2),
  ...votes("Kahramanmaraş", "kahramanmaras-istiklalspor", 1),
  ...votes("Mardin", "galatasaray", 1),
  ...votes("Muş", "galatasaray", 1),
  ...votes("Nevşehir", "galatasaray", 1),
  ...votes("Niğde", "galatasaray", 1),
  ...votes("Ordu", "52-orduspor", 1),
  ...votes("Samsun", "samsunspor", 2),
  ...votes("Sivas", "sivasspor", 2),
  ...votes("Tokat", "galatasaray", 1),
  ...votes("Van", "vanspor-fk", 2),
  ...votes("Kırıkkale", "galatasaray", 2),
  ...votes("Batman", "batman-petrolspor", 1),
  ...votes("Şırnak", "galatasaray", 1),
  ...votes("Iğdır", "igdir-fk", 1),

  ...votes("Adıyaman", "fenerbahce", 1),
  ...votes("Antalya", "antalyaspor", 2),
  ...votes("Aydın", "nazillispor", 2),
  ...votes("Balıkesir", "bandirmaspor", 1),
  ...votes("Denizli", "denizli-idman-yurdu", 2),
  ...votes("Edirne", "fenerbahce", 1),
  ...votes("Erzurum", "erzurumspor-fk", 1),
  ...votes("Hatay", "hatayspor", 2),
  ...votes("Isparta", "isparta-32", 1),
  ...votes("Mersin", "yeni-mersin-idmanyurdu", 2),
  ...votes("Kırklareli", "fenerbahce", 1),
  ...votes("Manisa", "manisa-fk", 1),
  ...votes("Muğla", "bodrum-fk", 1),
  ...votes("Rize", "caykur-rizespor", 1),
  ...votes("Şanlıurfa", "sanliurfaspor", 2),
  ...votes("Uşak", "usakspor", 1),
  ...votes("Tekirdağ", "fenerbahce", 1),
  ...votes("Osmaniye", "osmaniyespor", 1),

  ...votes("Bolu", "besiktas", 2),
  ...votes("Kastamonu", "besiktas", 1),
  ...votes("Yalova", "besiktas", 1),
  ...votes("Zonguldak", "besiktas", 1),
];

export function applyDemoVotes(db: Database.Database) {
  if (!isDemoRuntime()) {
    stripDemoVotes(db);
    return;
  }

  if (DEMO_VOTES.length !== 122) {
    throw new Error(`Demo oy ${DEMO_VOTES.length}, 122 bekleniyor.`);
  }

  const provinceSet = new Set<string>(PROVINCES);
  for (const [city, teamId] of DEMO_VOTES) {
    if (!provinceSet.has(city)) throw new Error(`Bilinmeyen il: ${city}`);
    if (!getTeam(teamId)) throw new Error(`Bilinmeyen takım: ${teamId}`);
  }

  const prefix = `seed.${SEED_VERSION}.`;
  const tagged = db
    .prepare(
      `SELECT COUNT(*) as c FROM participants
       WHERE email_norm LIKE ? AND deleted_at IS NULL AND verified_at IS NOT NULL`,
    )
    .get(SEED_EMAIL_LIKE) as { c: number };
  const seedVoteCount = db
    .prepare(
      `SELECT COUNT(*) as c FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE p.email_norm LIKE ? AND v.poll_id = ? AND v.revoked_at IS NULL`,
    )
    .get(SEED_EMAIL_LIKE, CURRENT_POLL_ID) as { c: number };
  const sample = db
    .prepare(
      `SELECT team_id FROM participants
       WHERE city = 'Mersin' AND email_norm LIKE 'seed.%' AND deleted_at IS NULL
       LIMIT 1`,
    )
    .get() as { team_id: string } | undefined;
  if (
    tagged.c === DEMO_VOTES.length &&
    seedVoteCount.c === DEMO_VOTES.length &&
    sample?.team_id === "yeni-mersin-idmanyurdu"
  ) {
    return;
  }

  if (
    tagged.c === DEMO_VOTES.length &&
    sample?.team_id === "yeni-mersin-idmanyurdu"
  ) {
    db.prepare(
      `INSERT INTO votes (participant_id, poll_id, team_id, city, cast_at)
       SELECT p.id, ?, p.team_id, p.city, p.verified_at
       FROM participants p
       WHERE p.email_norm LIKE ? AND p.verified_at IS NOT NULL AND p.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM votes v
           WHERE v.participant_id = p.id AND v.poll_id = ?
         )`,
    ).run(CURRENT_POLL_ID, SEED_EMAIL_LIKE, CURRENT_POLL_ID);
    return;
  }

  const now = new Date().toISOString();
  const wipe = db.transaction(() => {
    db.prepare(
      `DELETE FROM votes WHERE participant_id IN (
         SELECT id FROM participants WHERE email_norm LIKE ?
       )`,
    ).run(SEED_DOMAIN_LIKE);
    db.prepare(
      `DELETE FROM phone_otps WHERE participant_id IN (
         SELECT id FROM participants WHERE email_norm LIKE ?
       )`,
    ).run(SEED_DOMAIN_LIKE);
    db.prepare(
      `DELETE FROM verify_tokens WHERE participant_id IN (
         SELECT id FROM participants WHERE email_norm LIKE ?
       )`,
    ).run(SEED_DOMAIN_LIKE);
    db.prepare(`DELETE FROM participants WHERE email_norm LIKE ?`).run(
      SEED_DOMAIN_LIKE,
    );

    const insert = db.prepare(
      `INSERT INTO participants
       (email, email_norm, email_hash, first_name, last_name, phone, phone_norm, phone_hash,
        team_id, city, ip_hash, fingerprint_hash,
        consent_version, consent_at, created_at, verified_at, phone_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertVote = db.prepare(
      `INSERT INTO votes (participant_id, poll_id, team_id, city, cast_at)
       VALUES (?, ?, ?, ?, ?)`,
    );

    DEMO_VOTES.forEach(([city, teamId], i) => {
      const n = String(i + 1).padStart(3, "0");
      const email = `${prefix}${n}@${SEED_DOMAIN}`;
      const phoneNorm = String(5550100000 + i);
      const info = insert.run(
        email,
        email,
        identityEmailHash(email),
        "Demo",
        "Taraftar",
        phoneNorm,
        phoneNorm,
        identityPhoneHash(phoneNorm),
        teamId,
        city,
        `seed-ip-${n}`,
        `seed-fp-${n}`,
        CONSENT_VERSION,
        now,
        now,
        now,
        now,
      );
      insertVote.run(
        Number(info.lastInsertRowid),
        CURRENT_POLL_ID,
        teamId,
        city,
        now,
      );
    });
  });
  wipe();
}
