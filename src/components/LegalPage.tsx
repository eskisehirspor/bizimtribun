import Link from "next/link";

export default function LegalPage({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg px-4 py-10">
      <article className="max-w-[760px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-5 md:p-8">
        <p className="font-mono text-[11px] tracking-[0.2em]">{kicker}</p>
        <h1 className="font-anton text-[32px] md:text-[36px] leading-[0.9] mt-2">{title}</h1>
        <p className="mt-3 font-mono text-[12px] border-[2px] border-dashed border-black bg-[#FFEA00]/50 p-2">
          Taslak: Bu metin henüz bir hukukçu tarafından incelenmemiştir. Köşeli parantez içindeki
          alanlar yayından önce doldurulacaktır.
        </p>
        <div className="font-mono text-[13px] leading-[1.55] mt-5 space-y-4 [&_h2]:font-anton [&_h2]:text-[18px] [&_h2]:mt-6 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_table]:w-full [&_td]:border [&_td]:border-black [&_td]:p-1.5 [&_td]:align-top [&_th]:border [&_th]:border-black [&_th]:p-1.5 [&_th]:text-left">
          {children}
        </div>
        <Link href="/" className="mt-6 inline-block font-anton bg-black text-white px-4 py-2">
          ANA SAYFA
        </Link>
      </article>
    </main>
  );
}
