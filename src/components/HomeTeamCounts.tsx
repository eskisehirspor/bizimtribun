import Link from "next/link";
import { CITIES } from "@/lib/cities";
import { fanForm } from "@/lib/team-seo";

type Team = { id: string; name: string; votes: number };

const n = (v: number) => v.toLocaleString("tr-TR");

/**
 * Plain-text answer to what people search for ("X kaç taraftarı var",
 * "en çok taraftarı olan takım"), rendered on the server under the map.
 */
export default function HomeTeamCounts({ teams, total }: { teams: Team[]; total: number }) {
  // Stable sort: equal counts keep the catalog order (Süper Lig first).
  const top = [...teams].sort((a, b) => b.votes - a.votes).slice(0, 10);
  return (
    <section className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-6 pb-8">
      <div className="border-[4px] border-black bg-[#FFFEFA] p-4 md:p-6 shadow-[8px_8px_0_black]">
        <h2 className="font-anton text-[28px] md:text-[40px] leading-[1.05]">HANGİ TAKIMIN KAÇ TARAFTARI VAR?</h2>
        <p className="font-mono text-[14px] mt-3 max-w-[70ch]">
          Bizim Tribün, Türkiye&apos;nin taraftar sayımı. Her doğrulanmış hesap tek ve kalıcı bir takım oyu
          verir; taraftar sayıları anket ya da tahmin değil, gerçek kişilerin oyları. Şu an toplam{" "}
          <strong>{n(total)}</strong> doğrulanmış taraftar sayıldı.
        </p>
        <h3 className="font-anton text-[20px] md:text-[24px] mt-5">EN ÇOK TARAFTARI OLAN TAKIMLAR</h3>
        {top[0] && top[0].votes > 0 && (
          <p className="font-mono text-[13px] mt-1">
            Türkiye&apos;de en çok taraftarı olan takım şu an {top[0].name}: {n(top[0].votes)} doğrulanmış{" "}
            {fanForm(top[0].name)}. Kaç kişinin hangi takımı tuttuğunu görmek için takımına dokun.
          </p>
        )}
        <ol className="mt-2 grid sm:grid-cols-2 gap-x-6 border-t-[2px] border-black">
          {top.map((team, i) => (
            <li key={team.id} className="border-b-[2px] border-black">
              <Link
                href={`/takim/${team.id}`}
                className="flex min-h-11 items-center justify-between gap-3 py-2 font-mono text-[14px] hover:bg-[#FFEA00]/40"
              >
                <span>
                  {i + 1}. {team.name} taraftar sayısı
                </span>
                <span className="tabular-nums font-bold">{n(team.votes)}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="font-mono text-[13px] mt-4">
          <Link href="/takimlar" className="underline font-bold">
            Bütün takımların taraftar sayıları
          </Link>{" "}
        </p>
        <h3 className="font-anton text-[20px] md:text-[24px] mt-6">İLLERE GÖRE TARAFTAR SAYILARI</h3>
        <p className="font-mono text-[13px] mt-1">Hangi ilde en çok hangi takım tutuluyor? İlini seç.</p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[13px]">
          {CITIES.map((city) => (
            <li key={city.slug}>
              <Link href={`/il/${city.slug}`} className="underline hover:bg-[#FFEA00]/40">
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
