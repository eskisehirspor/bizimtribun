import { PROVINCES, type Province } from "./provinces";
import { foldTr } from "./teams";

export type CityRecord = {
  slug: string;
  name: Province;
  slogan: string | null;
  blurb: string | null;
};

function slugFromName(name: string) {
  return foldTr(name).replace(/\s+/g, "");
}

export const CITIES: readonly CityRecord[] = PROVINCES.map((name) => ({
  slug: slugFromName(name),
  name,
  slogan: null,
  blurb: null,
}));

const BY_SLUG = new Map(CITIES.map((city) => [city.slug, city]));
const BY_NAME = new Map(CITIES.map((city) => [city.name, city]));

export function citySlug(name: string) {
  return BY_NAME.get(name as Province)?.slug ?? slugFromName(name);
}

export function getCityBySlug(slug: string) {
  return BY_SLUG.get(slug);
}

export function getCityByName(name: string) {
  return BY_NAME.get(name as Province);
}

export function cityHeadline(city: CityRecord) {
  return city.slogan?.trim() || `${city.name} tribün sayımı`;
}

export function cityBlurb(city: CityRecord) {
  return (
    city.blurb?.trim() ||
    `${city.name} ilinde doğrulanmış taraftar oylarının dağılımı.`
  );
}

/** Turkish locative: Eskişehir'de, Bursa'da, Kars'ta, Siirt'te */
export function cityLocative(name: string) {
  const lower = name.toLocaleLowerCase("tr");
  const last = lower.slice(-1);
  const lastVowel =
    [...lower].reverse().find((ch) => "aeıioöuü".includes(ch)) || "a";
  const front = "eiöü".includes(lastVowel);
  const voiceless = "pçtkfhsş".includes(last);
  const suffix = voiceless ? (front ? "te" : "ta") : front ? "de" : "da";
  return `${name}'${suffix}`;
}
