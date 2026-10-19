"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import ForumBoardView from "@/components/forum/ForumBoardView";
import { getCityBySlug } from "@/lib/cities";

export default function CityForumPage() {
  const raw = useParams<{ citySlug: string }>().citySlug;
  const slug = (Array.isArray(raw) ? raw[0] : raw) || "";
  const city = getCityBySlug(slug);
  return (
    <ForumBoardView
      apiPath={`/api/forum/il/${slug}/topics`}
      newTopicPath={`/forum/il/${slug}/yeni`}
      backHref="/forum"
      backLabel="Tüm forumlar"
      active={Boolean(city)}
      closedTitle="İL BULUNAMADI"
      closedBody="Böyle bir il tribünü yok."
      header={(total) =>
        city ? (
          <div className="mt-3">
            <h1 className="font-anton text-[32px] sm:text-[42px] leading-[0.85]">
              {city.name.toLocaleUpperCase("tr")} TRİBÜNÜ
            </h1>
            <p className="font-mono text-[12px] mt-2 max-w-[56ch]">
              {city.name} taraftarlarının ortak alanı: yerel maçlar, deplasman buluşmaları, şehrin
              futbol gündemi. Konum bilgisi kullanılmaz; herkes istediği il tribününe yazabilir.
            </p>
            <p className="font-mono text-[11px] opacity-60 mt-1">
              {total} konu •{" "}
              <Link href={`/il/${city.slug}`} className="underline">
                {city.name} sayımı
              </Link>
            </p>
          </div>
        ) : null
      }
    />
  );
}
