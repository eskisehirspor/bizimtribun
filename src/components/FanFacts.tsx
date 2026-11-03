import Link from "next/link";
import type { FanFact } from "@/content/fan-facts";
import { blogPostPath, getPost } from "@/lib/blog";

/**
 * Sourced figures from surveys, Passolig and stadiums, each with its source,
 * plus links to the blog posts that explain them. Renders nothing when there
 * is nothing to show.
 */
export default function FanFacts({
  id,
  title,
  intro,
  facts,
  posts = [],
}: {
  id: string;
  title: string;
  intro?: string;
  facts: FanFact[];
  posts?: string[];
}) {
  const live = posts.flatMap((slug) => {
    const post = getPost(slug, undefined, false);
    return post ? [post] : [];
  });
  if (facts.length === 0 && live.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="font-anton text-[22px] leading-[1.05]">
        {title}
      </h2>
      {intro && <p className="font-mono text-[12px] mt-1 max-w-[70ch]">{intro}</p>}
      {facts.length > 0 && (
        <dl className="mt-3 grid gap-0 border-[3px] border-black bg-white sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}-${fact.source.url}`} className="border-[1.5px] border-black p-3 sm:odd:last:col-span-2">
              <dt className="font-mono text-[11px] tracking-wide">{fact.label.toLocaleUpperCase("tr")}</dt>
              <dd className="mt-1">
                <span className="font-anton text-[26px] leading-[1.05] tabular-nums">{fact.value}</span>
                {fact.note && <span className="block font-mono text-[12px] mt-1">{fact.note}</span>}
                <a
                  href={fact.source.url}
                  target="_blank"
                  rel="noopener"
                  className="mt-1 inline-flex min-h-8 items-center font-mono text-[11px] underline underline-offset-4 opacity-80 hover:opacity-100"
                >
                  Kaynak: {fact.source.publisher}, {fact.source.date}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {live.length > 0 && (
        <ul className="mt-3 space-y-1">
          {live.map((post) => (
            <li key={post.slug}>
              <Link
                href={blogPostPath(post.slug)}
                className="inline-flex min-h-10 items-center font-mono text-[13px] font-bold underline underline-offset-4 hover:bg-[#FFEA00]"
              >
                → {post.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
