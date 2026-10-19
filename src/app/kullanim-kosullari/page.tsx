import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Bizim Tribün",
  description: "Bizim Tribün üyelik, takım seçimi ve forum kuralları.",
  alternates: { canonical: "/kullanim-kosullari" },
};

export default function TermsPage() {
  return (
    <LegalPage kicker="KULLANIM KOŞULLARI • v2026-10-19" title="KULLANIM KOŞULLARI">
      <h2>Üyelik</h2>
      <p>
        Her hesap SMS ile doğrulanmış bir cep telefonuna bağlıdır ve bir numarayla aynı anda
        yalnızca bir hesap açılabilir. SMS doğrulaması bir kişinin kimliğini kesin olarak
        kanıtlamaz; sayım, doğrulanmış telefon numaralarını temsil eder.
      </p>
      <h2>Takım seçimi</h2>
      <p>
        Her hesap yalnızca bir takımı temsil eder. Onayladığın takım seçimi kalıcıdır:
        değiştirilemez, silinip yeniden verilemez ve başka takıma taşınamaz. Hesabını silersen
        oyun sayımdan düşer.
      </p>
      <h2>Forum</h2>
      <p>
        Hakaret, nefret söylemi, kişisel veri paylaşımı, spam ve yanıltıcı içerik yasaktır.
        Moderatörler kurallara aykırı içeriği kaldırabilir, hesapları geçici veya kalıcı olarak
        kısıtlayabilir.
      </p>
      <h2>Kötüye kullanım</h2>
      <p>
        Otomatik araçlarla hesap açmak, başkasının numarasını kullanmak veya sayımı
        manipüle etmeye çalışmak yasaktır; tespit edilen oylar gerekçesi kaydedilerek sayımdan
        çıkarılabilir.
      </p>
    </LegalPage>
  );
}
