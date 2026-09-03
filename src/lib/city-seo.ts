import { cityLocative, type CityRecord } from "./cities";

function origin() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function citySeoTitle(name: string) {
  return `${cityLocative(name)} En Çok Hangi Takım Tutuluyor? | Bizim Tribün`;
}

export function citySeoDescription(name: string) {
  return `${name} taraftar dağılımını, doğrulanmış oyları ve takım sıralamasını Bizim Tribün'de keşfet.`;
}

export function cityCanonical(slug: string) {
  return `${origin()}/il/${slug}`;
}

export function cityPageMetadata(city: CityRecord) {
  const title = citySeoTitle(city.name);
  const description = citySeoDescription(city.name);
  const url = cityCanonical(city.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      locale: "tr_TR",
      type: "website" as const,
      siteName: "Bizim Tribün",
    },
    twitter: {
      card: "summary" as const,
      title,
      description,
    },
  };
}
