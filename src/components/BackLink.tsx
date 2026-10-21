import Link from "next/link";

/** "← Somewhere" link with a full tap area. Works in server and client components. */
export default function BackLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2 font-mono text-[13px] underline underline-offset-4 decoration-2 hover:bg-black/5 pr-2 ${className}`}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
