import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import PostBody from "@/components/blog/PostBody";
import PostMeta from "@/components/blog/PostMeta";
import { btnAccent } from "@/components/ui";
import { BLOG_PATH, BLOG_TITLE, blogPostPath, formatPostDate, getPost, listPosts, readingMinutes } from "@/lib/blog";
import { inlineText, parseMarkdown } from "@/lib/blog-markdown";
import { HOME_CRUMB, articleJsonLd, articlePageMetadata, breadcrumbJsonLd, graph } from "@/lib/seo";

export function generateStaticParams() {
  return listPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { robots: { index: false, follow: false } };
  const meta = articlePageMetadata({
    title: `${post.title} | Bizim Tribün`,
    description: post.description,
    path: blogPostPath(post.slug),
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  });
  // A draft only ever renders in development, but never let one be indexed.
  return post.status === "draft" ? { ...meta, robots: { index: false, follow: false } } : meta;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const blocks = parseMarkdown(post.body);
  const toc = blocks.flatMap((b) => (b.type === "heading" && b.level === 2 ? [{ id: b.id, text: inlineText(b.children) }] : []));
  const more = listPosts().filter((p) => p.slug !== post.slug).slice(0, 3);
  const path = blogPostPath(post.slug);

  return (
    <div className="bg-paper text-ink">
      <JsonLd
        data={graph(
          breadcrumbJsonLd([HOME_CRUMB, { name: BLOG_TITLE, path: BLOG_PATH }, { name: post.title, path }]),
          articleJsonLd({
            path,
            title: post.title,
            description: post.description,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            citations: post.sources,
          }),
        )}
      />

      {post.status === "draft" && (
        <p className="border-b-[3px] border-line bg-flare px-4 py-2 text-center font-mono text-[13px] text-white">
          Taslak: yalnızca geliştirme ortamında görünür, yayında yok.
        </p>
      )}

      <header className="border-b-[3px] border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8 md:py-14">
          <nav aria-label="Konum" className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
            <Link href={BLOG_PATH} className="underline underline-offset-4 hover:text-ink">
              {BLOG_TITLE}
            </Link>
          </nav>
          <h1 className="mt-4 max-w-[22ch] font-anton text-[38px] uppercase leading-[1.04] tracking-tight md:text-[60px]">
            {post.title}
          </h1>
          <p className="mt-4 max-w-[60ch] text-[18px] leading-relaxed text-muted md:text-[20px]">{post.description}</p>
          <div className="mt-5">
            <PostMeta date={post.publishedAt} minutes={readingMinutes(post)} draft={post.status === "draft"} />
            {post.updatedAt && (
              <p className="mt-1 font-mono text-[12px] text-muted">
                Güncellendi: <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-10 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
        <article>
          {toc.length >= 3 && (
            <nav aria-label="Bu yazıda" className="mb-10 border-l-[6px] border-volt pl-4 lg:hidden">
              <TocList items={toc} />
            </nav>
          )}
          <PostBody blocks={blocks} />

          {post.sources.length > 0 && (
            <section aria-labelledby="kaynaklar" className="mt-14 max-w-[68ch] border-t-[3px] border-line pt-6">
              <h2 id="kaynaklar" className="font-anton text-[24px] uppercase leading-none">
                Kaynaklar
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-6 text-[15px] leading-relaxed">
                {post.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4 hover:bg-volt">
                      {s.title}
                    </a>
                    <span className="text-muted">
                      {" "}
                      · {s.publisher}, {s.date}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <aside className="mt-14 max-w-[68ch] border-[3px] border-line bg-ink p-6 text-surface shadow-[6px_6px_0_var(--color-volt)]">
            <p className="font-anton text-[26px] uppercase leading-tight text-volt">Sen de sayıl</p>
            <p className="mt-2 text-[16px] leading-relaxed text-white/85">
              Doğrulanmış hesabınla takımına bir kez oy ver; ilin haritada takımının rengine boyansın.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/uye-ol" className={btnAccent}>
                Takımını seç →
              </Link>
              <Link href="/" className="inline-flex min-h-11 items-center justify-center border-[3px] border-white/40 px-4 font-anton text-[15px] text-surface hover:border-volt hover:text-volt">
                Haritayı gör
              </Link>
            </div>
          </aside>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-10">
            {toc.length >= 3 && (
              <nav aria-label="Bu yazıda">
                <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">Bu yazıda</p>
                <div className="mt-3 border-l-[3px] border-line pl-4">
                  <TocList items={toc} />
                </div>
              </nav>
            )}
            {more.length > 0 && (
              <nav aria-label="Diğer yazılar">
                <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">Diğer yazılar</p>
                <ul className="mt-3 border-t-[2px] border-line">
                  {more.map((p) => (
                    <li key={p.slug} className="border-b-[2px] border-hairline">
                      <Link href={blogPostPath(p.slug)} className="block py-3 text-[15px] font-semibold leading-snug hover:underline">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </aside>
      </main>

      {more.length > 0 && (
        <section aria-labelledby="diger-yazilar" className="border-t-[3px] border-line bg-surface lg:hidden">
          <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
            <h2 id="diger-yazilar" className="font-anton text-[24px] uppercase leading-none">
              Diğer yazılar
            </h2>
            <ul className="mt-4 border-t-[2px] border-line">
              {more.map((p) => (
                <li key={p.slug} className="border-b-[2px] border-hairline">
                  <Link href={blogPostPath(p.slug)} className="block py-4 font-semibold leading-snug hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function TocList({ items }: { items: { id: string; text: string }[] }) {
  return (
    <ol className="space-y-2 text-[15px] leading-snug">
      {items.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className="hover:underline underline-offset-4">
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
