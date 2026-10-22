import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import KvkkText from "@/components/legal/KvkkText";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Bizim Tribün",
  description: "Bizim Tribün'ün kişisel verileri hangi amaçla, hangi hukuki sebeple ve ne kadar süre işlediği.",
  alternates: { canonical: "/kvkk" },
};

export default function KvkkPage() {
  const v = LEGAL_DOCS.privacy.version;
  return (
    <LegalPage kicker={`KVKK • AYDINLATMA METNİ • SÜRÜM ${v}`} title="KİŞİSEL VERİLERİN İŞLENMESİ HAKKINDA AYDINLATMA METNİ">
      <KvkkText />
    </LegalPage>
  );
}
