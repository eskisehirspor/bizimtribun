import Link from "next/link";
import { btnSecondary } from "@/components/ui";

/** Old e-mail census links land here. That census is closed; see docs/data-policy.md. */
export default function DogrulaPage() {
  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg px-4 py-10">
      <div className="max-w-[520px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-6">
        <h1 className="font-anton text-[34px] leading-[0.9]">E-POSTA SAYIMI KAPANDI</h1>
        <p className="font-mono text-[13px] mt-4 leading-[1.5]">
          Bizim Tribün artık SMS ile doğrulanmış üyelik kullanıyor. Her hesap tek bir takım
          seçer ve sayaçlar yalnızca bu seçimlerden hesaplanır. Eski e-posta linkleri artık oy
          kaydetmez.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/uye-ol" className="font-anton bg-black text-white px-4 py-2">
            ÜYE OL
          </Link>
          <Link href="/sil-verilerim" className={btnSecondary}>
            ESKİ KAYDIMI SİL
          </Link>
        </div>
      </div>
    </main>
  );
}
