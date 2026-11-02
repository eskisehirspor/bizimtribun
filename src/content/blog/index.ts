import type { BlogPost } from "@/lib/blog";
import { post as anadoluKulupleri } from "./anadolu-kulupleri-taraftar-sayisi";
import { post as nasilSayiyor } from "./bizim-tribun-nasil-sayiyor";
import { post as enCokTaraftar } from "./en-cok-taraftari-olan-takim";
import { post as eskisehirspor } from "./eskisehirspor-taraftari";
import { post as ilIlTakim } from "./hangi-ilde-hangi-takim-tutuluyor";
import { post as passolig } from "./passolig-kart-sayisi";
import { post as seyirciOrtalamalari } from "./super-lig-seyirci-ortalamalari";
import { post as stadyumlar } from "./super-lig-stadyumlari-ve-kapasiteleri";
import { post as anketlerFarkli } from "./taraftar-anketleri-neden-farkli-sonuc-veriyor";
import { post as trabzonspor } from "./trabzonspor-taraftar-sayisi";

/** Every post, in any order; src/lib/blog.ts sorts, filters and releases them by date. */
export const BLOG_POSTS: BlogPost[] = [
  enCokTaraftar,
  ilIlTakim,
  nasilSayiyor,
  // One a day from 3 November 2026, released at 00:00 Türkiye time.
  seyirciOrtalamalari,
  stadyumlar,
  trabzonspor,
  anadoluKulupleri,
  eskisehirspor,
  anketlerFarkli,
  passolig,
];
