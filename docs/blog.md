# Blog (Tribün Notları)

Yazılar `src/content/blog/` altında, her biri bir `.ts` dosyası. Worker'da dosya sistemi olmadığı için
yazılar kodla birlikte paketlenir; yeni yazı için deploy gerekir.

## Yeni yazı

1. `src/content/blog/<slug>.ts` dosyasını mevcut bir yazıdan kopyala, `slug`, `title` (en fazla 70),
   `description` (50-160 karakter), `publishedAt` (YYYY-AA-GG) ve `body` alanlarını doldur.
2. `src/content/blog/index.ts` içindeki `BLOG_POSTS` listesine ekle.
3. Bizim Tribün'ün kendi sayımından gelmeyen her rakam için `sources` listesine kaynak ekle (https).

`body` küçük bir Markdown alt kümesidir: `##` / `###` başlık, paragraf, `-` ve `1.` listeler,
`>` alıntı, `| tablo |`, `**kalın**`, `*eğik*`, `[bağlantı](/il/eskisehir)`. Bağlantılar yalnızca site
içi yollar ve `https://` adresleri olabilir.

## Taslak ve yayın

- `status: "draft"`: yalnızca `npm run dev` ile görünür (kırmızı "Taslak" şeridiyle, `noindex`).
  Üretimde 404 verir; listede, sitemap'te ve llms.txt'te yer almaz.
- `status: "published"`: `/blog`, ana sayfadaki "Tribün Notları", sitemap ve llms.txt'e girer.

`npm test`, her yazının alanlarını, bağlantılarının (il, takım, diğer yazı) gerçekten var olduğunu
ve slug'ların tekrar etmediğini kontrol eder.
