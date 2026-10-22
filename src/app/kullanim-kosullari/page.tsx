import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import TermsText from "@/components/legal/TermsText";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Bizim Tribün",
  description: "Bizim Tribün üyelik, takım seçimi, forum kuralları ve sorumluluklar.",
  alternates: { canonical: "/kullanim-kosullari" },
};

export default function TermsPage() {
  const v = LEGAL_DOCS.terms.version;
  return (
    <LegalPage kicker={`KULLANIM KOŞULLARI • SÜRÜM ${v}`} title="KULLANIM KOŞULLARI">
      <TermsText />
    </LegalPage>
  );
}
