import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import PostMeta from "@/components/blog/PostMeta";
import { BLOG_PATH, BLOG_TITLE, blogPostPath, listPosts, readingMinutes } from "@/lib/blog";
import { HOME_CRUMB, breadcrumbJsonLd, graph, publicPageMetadata } from "@/lib/seo";
import { btnPrimary } from "@/components/ui";

export const metadata = publicPageMetadata({
  title: `${BLOG_TITLE}: Taraftarlık, Sayım ve Tribün Yazıları | Bizim Tribün`,
  description:
    "Türkiye'de hangi takımın kaç taraftarı var, anketler ne diyor, il il kim önde? Kaynaklı, sade yazılar ve Bizim Tribün sayımının arkası.",
  path: BLOG_PATH,
});

export default function BlogIndexPage() {
  const posts = listPosts();
  const [lead, ...rest] = posts;
  return (
    <div className="bg-paper text-ink">
      <JsonLd data={graph(breadcrumbJsonLd([HOME_CRUMB, { name: BLOG_TITLE, path: BLOG_PATH }]))} />
      <header className="border-b-[3px] border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8 md:py-14">
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">Blog</p>
          <h1 className="mt-3 font-anton text-[44px] uppercase leading-[1.02] tracking-tight md:text-[64px]">
            {BLOG_TITLE}
          </h1>
          <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed md:text-[19px]">
            Taraftarlık üzerine kaynaklı yazılar: anketler ne diyor, iller nasıl ayrışıyor, sayım nasıl
            yapılıyor. Rakamlar ya kaynağıyla ya da Bizim Tribün&apos;ün kendi sayımıyla.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-10 md:px-8 md:py-14">
        {posts.length === 0 ? (
          <div className="max-w-[60ch] border-[3px] border-dashed border-line/40 p-6">
            <p className="font-semibold">İlk yazılar hazırlanıyor.</p>
            <p className="mt-1 text-muted">O zamana kadar canlı sayıma göz at.</p>
            <Link href="/" className={`mt-4 ${btnPrimary}`}>
              Taraftar haritası →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-12">
            {lead && (
              <article className="border-[3px] border-line bg-surface shadow-[6px_6px_0_var(--color-ink)]">
                <Link href={blogPostPath(lead.slug)} className="group block p-6 md:p-8">
                  <PostMeta date={lead.publishedAt} minutes={readingMinutes(lead)} draft={lead.status === "draft"} />
                  <h2 className="mt-3 font-anton text-[34px] uppercase leading-[1.02] tracking-tight group-hover:underline md:text-[44px]">
                    {lead.title}
                  </h2>
                  <p className="mt-4 text-[17px] leading-relaxed text-muted">{lead.description}</p>
                  <span className="mt-6 inline-flex font-semibold underline decoration-volt decoration-2 underline-offset-4">
                    Yazıyı oku →
                  </span>
                </Link>
              </article>
            )}
            {rest.length > 0 && (
              <ul className="border-t-[3px] border-line">
                {rest.map((post) => (
                  <li key={post.slug} className="border-b-[2px] border-hairline">
                    <Link href={blogPostPath(post.slug)} className="group block py-5 hover:bg-surface md:px-2">
                      <PostMeta date={post.publishedAt} minutes={readingMinutes(post)} draft={post.status === "draft"} />
                      <h2 className="mt-2 text-[20px] font-bold leading-snug group-hover:underline">{post.title}</h2>
                      <p className="mt-1 text-[15px] leading-relaxed text-muted">{post.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
