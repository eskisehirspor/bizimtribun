import Link from "next/link";
import { CITIES } from "@/lib/cities";
import { fanForm } from "@/lib/team-seo";

type Team = { id: string; name: string; votes: number };

const n = (v: number) => v.toLocaleString("tr-TR");

/**
 * Plain-text answer to what people search for ("X kaç taraftarı var",
 * "en çok taraftarı olan takım"), rendered on the server under the map.
 * It always counts verified votes only; when the map above adds the opening
 * data, a note says so, so the two never look like they disagree.
 */
export default function HomeTeamCounts({
  teams,
  total,
  openingShown = false,
}: {
  teams: Team[];
  total: number;
  openingShown?: boolean;
}) {
  // Stable sort: equal counts keep the catalog order (Süper Lig first).
  const top = [...teams].sort((a, b) => b.votes - a.votes).slice(0, 10);
  return (
    <section aria-labelledby="sayilar-baslik" className="border-t-[3px] border-line bg-surface">
      <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8 md:py-14">
        <h2 id="sayilar-baslik" className="font-anton text-[30px] md:text-[40px] leading-[1.05] tracking-tight uppercase">
          Hangi takımın kaç taraftarı var?
        </h2>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed">
          Bizim Tribün, Türkiye&apos;nin taraftar sayımı. Her doğrulanmış hesap tek ve kalıcı bir takım oyu
          verir; taraftar sayıları anket ya da tahmin değil, gerçek kişilerin oyları. Şu an toplam{" "}
          <strong>{n(total)}</strong> doğrulanmış taraftar sayıldı.
        </p>
        {openingShown && (
          <p className="mt-2 max-w-[68ch] font-mono text-[13px] text-muted">
            Bu bölüm yalnızca doğrulanmış oyları sayar; yukarıdaki harita ve sıralama açılış verisini de içerir.
          </p>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="font-anton text-[22px] uppercase leading-none">En çok taraftarı olan takımlar</h3>
            {top[0] && top[0].votes > 0 && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Türkiye&apos;de en çok taraftarı olan takım şu an {top[0].name}: {n(top[0].votes)} doğrulanmış{" "}
                {fanForm(top[0].name)}. Kaç kişinin hangi takımı tuttuğunu görmek için takımına dokun.
              </p>
            )}
            <ol className="mt-3 border-t-[2px] border-line">
              {top.map((team, i) => (
                <li key={team.id} className="border-b-[2px] border-hairline">
                  <Link
                    href={`/takim/${team.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-[15px] hover:bg-volt/40"
                  >
                    <span>
                      <span className="inline-block w-7 font-mono text-[13px] text-muted">{i + 1}.</span>
                      {team.name} taraftar sayısı
                    </span>
                    <span className="font-anton text-[18px] tabular-nums">{n(team.votes)}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4">
              <Link href="/takimlar" className="font-semibold underline underline-offset-4 hover:bg-volt">
                Bütün takımların taraftar sayıları →
              </Link>
            </p>
          </div>

          <div>
            <h3 className="font-anton text-[22px] uppercase leading-none">İllere göre taraftar sayıları</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Hangi ilde en çok hangi takım tutuluyor? İlini seç.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 border-t-[2px] border-line sm:grid-cols-3 xl:grid-cols-4">
              {CITIES.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/il/${city.slug}`}
                    className="flex min-h-10 items-center border-b border-hairline text-[14px] hover:bg-volt/40"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
