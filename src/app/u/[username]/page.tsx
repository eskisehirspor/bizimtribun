import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ForumShell from "@/components/ForumShell";
import JsonLd from "@/components/JsonLd";
import ProfileActions from "@/components/profile/ProfileActions";
import ProfileActivity from "@/components/profile/ProfileActivity";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, isStaffRole } from "@/lib/permissions";
import { AVATAR_EMOJI, getPublicProfile, listProfileActivity, XP_PER_LIKE } from "@/lib/profiles";
import { getCatalogTeam } from "@/lib/team-catalog";
import { initials, teamBadge } from "@/lib/teams";
import { btnAccent, btnSm, labelClass } from "@/components/ui";
import { DEFAULT_SHARE_IMAGE, absoluteUrl, graph } from "@/lib/seo";

export const dynamic = "force-dynamic";

function origin() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  // Metadata never depends on the viewer: only public profiles are described
  // and indexed; members-only profiles stay out of search engines.
  const found = await getPublicProfile(getDb(), username, { signedIn: false });
  if (!found.ok) {
    return { title: "Üye profili | Bizim Tribün", robots: { index: false, follow: false } };
  }
  const p = found.profile;
  const team = p.teamId ? await getCatalogTeam(p.teamId) : undefined;
  const title = `@${p.username}${team ? ` • ${team.name} taraftarı` : ""} | Bizim Tribün`;
  const description = `@${p.username} Bizim Tribün'de ${p.counts.topics} konu ve ${p.counts.posts} yorum yazdı.`;
  const url = `${origin()}/u/${p.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, locale: "tr_TR", type: "profile", siteName: "Bizim Tribün", images: [DEFAULT_SHARE_IMAGE] },
  };
}

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getSessionUser();
  const db = getDb();
  const found = await getPublicProfile(db, username, { signedIn: Boolean(viewer) });
  if (!found.ok && found.status === 404) notFound();
  if (!found.ok) {
    return (
      <ForumShell>
        <div className="max-w-[560px] mx-auto bg-white border-[4px] border-black p-5">
          <h1 className="font-anton text-[32px]">@{username.toLowerCase()}</h1>
          <p className="font-mono text-[13px] mt-2">Bu profil yalnızca üyelere açık.</p>
          <Link
            href={`/giris?next=${encodeURIComponent(`/u/${username}`)}`}
            className={`mt-4 ${btnAccent}`}
          >
            GİRİŞ YAP
          </Link>
        </div>
      </ForumShell>
    );
  }
  const p = found.profile;
  const team = p.teamId ? await getCatalogTeam(p.teamId) : undefined;
  const isSelf = viewer?.id === p.id;
  const firstPage = await listProfileActivity(db, p.id, 0, 21, viewer);
  // Only profiles open to everyone are described to search engines.
  const profileJsonLd =
    p.visibility === "public"
      ? graph({
          "@type": "ProfilePage",
          url: absoluteUrl(`/u/${p.username}`),
          dateCreated: p.memberSince,
          mainEntity: {
            "@type": "Person",
            name: p.username,
            alternateName: `@${p.username}`,
            identifier: String(p.id),
            url: absoluteUrl(`/u/${p.username}`),
            agentInteractionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/WriteAction",
              userInteractionCount: p.counts.topics + p.counts.posts,
            },
          },
        })
      : null;

  return (
    <ForumShell>
      {profileJsonLd && <JsonLd data={profileJsonLd} />}
      <section className="bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black]">
        <div
          className="flex flex-wrap items-center gap-4 p-5 border-b-[4px] border-black"
          style={{ background: team?.paper ?? "#FFFEFA" }}
        >
          <div
            aria-hidden
            className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 border-[4px] border-black flex items-center justify-center font-anton text-[30px]"
            style={team ? { background: teamBadge(team).bg, color: teamBadge(team).fg } : { background: "#111", color: "#fff" }}
          >
            {p.avatar ? <span className="text-[38px]">{AVATAR_EMOJI[p.avatar]}</span> : initials(p.username)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYE</p>
            <h1 className="font-anton text-[34px] sm:text-[42px] leading-[0.9] break-words">@{p.username}</h1>
            {p.displayName && <p className="font-mono text-[13px] mt-1">{p.displayName}</p>}
            <p className="font-mono text-[12px] mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {team ? (
                <Link href={`/takim/${team.id}`} className="underline font-bold">
                  {team.name}
                </Link>
              ) : (
                <span>Takım seçilmedi</span>
              )}
              {p.province && <span>{p.province}</span>}
              <span>{monthYear(p.memberSince)} tarihinden beri üye</span>
              {isStaffRole(p.role) && (
                <span className="bg-black text-[#FFEA00] px-1">{ROLE_LABELS[p.role] ?? p.role}</span>
              )}
            </p>
          </div>
          {isSelf && (
            <Link
              href="/hesap#profil"
              className={`w-full sm:w-auto ${btnSm}`}
            >
              PROFİLİ DÜZENLE
            </Link>
          )}
        </div>

        {p.bio && <p className="px-5 pt-4 font-mono text-[13px] whitespace-pre-line break-words">{p.bio}</p>}

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-0 m-5 border-[3px] border-black">
          {[
            ["KONU", p.counts.topics],
            ["YORUM", p.counts.posts],
            ["ALDIĞI BEĞENİ", p.counts.likesReceived],
            ["KATKI PUANI", p.xp],
          ].map(([label, value]) => (
            <div key={label} className="p-3 border-[1.5px] border-black bg-white">
              <dt className={labelClass}>{label}</dt>
              <dd className="font-anton text-[26px] leading-none">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="px-5 -mt-3 font-mono text-[12px]">
          Seviye: <b>{p.level.label}</b>
          {p.level.next ? ` • ${p.level.next.label} için ${p.level.next.min - p.xp} puan daha` : ""}
        </p>
        <p className="px-5 font-mono text-[12px] opacity-60">
          Katkı puanı yalnızca forum katkısını gösterir (günde en fazla 10 yazma puanı, her beğeni {XP_PER_LIKE}{" "}
          puan); taraftar sayımını ve takım sıralamasını etkilemez.
        </p>

        <div className="p-5">
          <h2 className="font-anton text-[20px]">ROZETLER</h2>
          {p.badges.length === 0 ? (
            <p className="font-mono text-[12px] opacity-70 mt-1">Henüz rozet yok.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {p.badges.map((b) => (
                <li key={b.key} title={b.description} className="border-[3px] border-black bg-[#FFEA00] px-2 py-1">
                  <span className="font-anton text-[13px]">{b.label.toLocaleUpperCase("tr")}</span>
                  <span className={`block ${labelClass}`}>{b.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {viewer && !isSelf && (
          <div className="px-5 pb-4">
            <ProfileActions userId={p.id} username={p.username} />
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-anton text-[24px]">SON KATKILAR</h2>
        <ProfileActivity username={p.username} initial={firstPage.slice(0, 20)} initialHasMore={firstPage.length > 20} />
      </section>
    </ForumShell>
  );
}
