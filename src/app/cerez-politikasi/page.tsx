import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { COOKIE_POLICY, LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Çerez Politikası | Bizim Tribün",
  description: "Bizim Tribün'ün kullandığı çerezler ve amaçları.",
  alternates: { canonical: "/cerez-politikasi" },
};

const COOKIES = [
  {
    name: "bt_session",
    purpose: "Giriş yaptığını hatırlamak (oturum).",
    duration: "En fazla 30 gün. Yöneticilerde 8 saat.",
  },
  {
    name: "bt_signup",
    purpose: "E-posta ya da telefon doğrulandıktan sonra üyelik formunu tamamlamak.",
    duration: "15 dakika",
  },
  {
    name: "bt_device",
    purpose:
      "Aynı tarayıcıdan açılan hesap sayısını sınırlamak. Rastgele bir kimlik taşır; sunucuda yalnızca anahtarlı özeti ve hesap açılış tarihi 1 yıl tutulur.",
    duration: "2 yıl",
  },
  {
    name: "bt_admin_2fa",
    purpose: "Yönetici girişinde iki adımlı doğrulama adımını tamamlamak.",
    duration: "5 dakika",
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage kicker={`ÇEREZ POLİTİKASI • SÜRÜM ${COOKIE_POLICY.version}`} title="ÇEREZ POLİTİKASI">
      <p>
        Bizim Tribün yalnızca sitenin çalışması için <strong>zorunlu</strong> çerezleri kullanır.
        Analitik, reklam, pazarlama ya da sosyal medya takip çerezi kullanılmaz. Bu nedenle çerez onayı
        istenmez. Zorunlu çerezler, KVKK md. 5/2-c (sözleşmenin ifası) ve 5/2-f (meşru menfaat)
        kapsamında, istediğin hizmeti sunmak için kullanılır.
      </p>

      <h2>Kullandığımız çerezler</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Çerez</th>
              <th>Amaç</th>
              <th>Süre</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name}>
                <td className="whitespace-nowrap">{c.name}</td>
                <td>{c.purpose}</td>
                <td>{c.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Bu çerezler yalnızca bu siteye aittir (birinci taraf). Tarayıcı dışından okunamazlar (HttpOnly)
        ve canlı sitede yalnızca güvenli bağlantı üzerinden gönderilirler.
      </p>

      <h2>Üçüncü taraf hizmetler</h2>
      <p>
        SMS kodu istenirken bot kontrolü için Cloudflare Turnstile kullanılır. Turnstile bu kontrol
        sırasında tarayıcı bilgilerini işler ve kendi teknik verilerini kullanabilir. Bu veriler reklam
        için kullanılmaz. Yazı tipleri sitenin kendi sunucusundan yüklenir, dış bir yazı tipi
        servisine istek gitmez.
      </p>

      <h2>Çerezleri nasıl yönetirsin?</h2>
      <p>
        Çerezleri tarayıcı ayarlarından silebilir ya da engelleyebilirsin. Zorunlu çerezleri
        engellersen giriş yapamaz ve üye olamazsın. Çıkış yaptığında oturum çerezi silinir.
      </p>

      <h2>Daha fazla bilgi</h2>
      <p>
        Kişisel verilerinin nasıl işlendiğini{" "}
        <Link className="underline" href="/kvkk">
          Aydınlatma Metni
        </Link>
        &apos;nde bulabilirsin. Sorular için: {LEGAL_ENTITY.email}
      </p>
    </LegalPage>
  );
}
