import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/blog-markdown";

function renderInline(nodes: Inline[], key = ""): ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}${i}`;
    switch (node.type) {
      case "text":
        return node.text;
      case "strong":
        return <strong key={k} className="font-semibold">{renderInline(node.children, `${k}-`)}</strong>;
      case "em":
        return <em key={k}>{renderInline(node.children, `${k}-`)}</em>;
      case "link": {
        const children = renderInline(node.children, `${k}-`);
        const cls = "font-semibold underline decoration-2 underline-offset-4 decoration-volt hover:bg-volt";
        return node.href.startsWith("https://") ? (
          <a key={k} href={node.href} target="_blank" rel="noopener" className={cls}>
            {children}
          </a>
        ) : (
          <Link key={k} href={node.href} className={cls}>
            {children}
          </Link>
        );
      }
    }
  });
}

/** A parsed post body, typeset for long reading (about 68 characters a line). */
export default function PostBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-[68ch] text-[17px] leading-[1.75] md:text-[18px]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2
                key={i}
                id={block.id}
                className="mt-12 mb-3 scroll-mt-6 font-anton text-[28px] uppercase leading-[1.05] tracking-tight md:text-[32px]"
              >
                {renderInline(block.children)}
              </h2>
            ) : (
              <h3 key={i} id={block.id} className="mt-8 mb-2 scroll-mt-6 text-[19px] font-bold leading-snug">
                {renderInline(block.children)}
              </h3>
            );
          case "paragraph":
            return (
              <p key={i} className="mt-5 first:mt-0">
                {renderInline(block.children)}
              </p>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag
                key={i}
                className={`mt-5 space-y-2 pl-6 marker:font-bold ${block.ordered ? "list-decimal" : "list-disc marker:text-ink"}`}
              >
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="mt-6 border-l-[6px] border-volt bg-surface py-3 pr-4 pl-5 text-[18px] font-medium">
                {renderInline(block.children)}
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="mt-6 overflow-x-auto border-[3px] border-line bg-surface">
                {/* Wide tables scroll inside their frame on phones; narrow ones just fit. */}
                <table
                  className={`w-full border-collapse text-[15px] leading-snug ${block.head.length > 3 ? "min-w-[520px]" : ""}`}
                >
                  <thead>
                    <tr className="bg-ink text-surface">
                      {block.head.map((cell, j) => (
                        <th key={j} scope="col" className="px-3 py-2 text-left font-mono text-[12px] font-normal uppercase tracking-[0.08em]">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-t-[2px] border-hairline">
                        {row.map((cell, j) =>
                          j === 0 ? (
                            <th key={j} scope="row" className="px-3 py-2 text-left font-semibold">
                              {renderInline(cell)}
                            </th>
                          ) : (
                            <td key={j} className="px-3 py-2 tabular-nums">
                              {renderInline(cell)}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
