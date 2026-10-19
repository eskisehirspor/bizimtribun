import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Bizim Tribün",
  description: "Bizim Tribün'ün kişisel verileri hangi amaçla, ne kadar süre işlediği.",
  alternates: { canonical: "/kvkk" },
};

export default function KvkkPage() {
  return (
    <LegalPage kicker="KVKK • AYDINLATMA METNİ • v2026-10-19" title="KİŞİSEL VERİLERİN İŞLENMESİ">
      <h2>Veri sorumlusu</h2>
      <p>
        Bizim Tribün platformu. Başvurular için hesabındaki silme aracını ya da sitede
        yayımlanan iletişim adresini kullanabilirsin.
      </p>
      <h2>Hangi verileri neden işliyoruz?</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Cep telefonu:</strong> Hesabı SMS koduyla doğrulamak, giriş yapmak ve bir
          numarayla yalnızca bir hesap açılmasını sağlamak. Herkese açık profilde gösterilmez.
        </li>
        <li>
          <strong>Kullanıcı adı, isteğe bağlı görünen ad:</strong> Forumda ve profilde seni
          göstermek.
        </li>
        <li>
          <strong>Takım tercihi ve isteğe bağlı il:</strong> Taraftar sayımı ve il sıralamaları.
          İlini konumundan veya IP adresinden tahmin etmeyiz.
        </li>
        <li>
          <strong>Forum içerikleri, beğeniler, raporlar ve engellemeler:</strong> Topluluk hizmetini
          sunmak ve moderasyon. Rapor ettiğin içerik ve gerekçen yalnızca moderatörlere görünür.
        </li>
        <li>
          <strong>Profil:</strong> İsteğe bağlı görünen ad, kısa tanıtım ve hazır avatar. Profilin
          varsayılan olarak yalnızca giriş yapmış üyelere açıktır; herkese açık yapmayı ve ilini
          göstermeyi sen seçersin. Rozetler ve katkı puanı yalnızca forum katkısından hesaplanır.
        </li>
        <li>
          <strong>Bildirimler:</strong> Yalnızca site içinde gösterilir; SMS veya e-posta ile
          gönderilmez. Hangi bildirimleri alacağını Hesabım sayfasından seçebilirsin.
        </li>
        <li>
          <strong>Güvenlik kayıtları:</strong> IP adresi ve tarayıcı bilgisi ham hâliyle
          saklanmaz; kötüye kullanımı sınırlamak için anahtarlı özetleri (HMAC) kısa süre tutulur.
          SMS kodları yalnızca özet olarak saklanır, kayıtlara yazılmaz.
        </li>
      </ul>
      <p>
        Eski şifreli hesaplarda ayrıca ad, soyad, doğum tarihi ve e-posta bulunabilir. Bunlar
        herkese açık değildir ve hesap silindiğinde silinir.
      </p>
      <h2>Hukuki sebep</h2>
      <p>
        6698 sayılı Kanun md. 5/2-c (sözleşmenin kurulması ve ifası: üyelik ve sayım hizmeti) ve
        md. 5/2-f (meşru menfaat: dolandırıcılık ve kötüye kullanımın önlenmesi).
      </p>
      <h2>Aktarım</h2>
      <p>
        SMS kodu göndermek için telefon numaran SMS sağlayıcısına, bot koruması için tarayıcı
        bilgilerin Cloudflare Turnstile&apos;a iletilir. E-posta kullanılırsa e-posta altyapısı
        (Resend). Veriler satılmaz ve reklam amaçlı paylaşılmaz.
      </p>
      <h2>Saklama ve silme</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Hesap açık olduğu sürece veriler saklanır.</li>
        <li>
          Hesabını sildiğinde telefon, e-posta, ad-soyad, doğum tarihi, il ve şifre bilgilerin
          silinir; takım oyun sayımdan düşer. Forum yazıların &quot;Silinmiş üye&quot; adıyla
          kalır; silinmesini istediğin yazıları hesabını kapatmadan önce kendin silebilirsin.
        </li>
        <li>
          Silmenin ardından aynı numarayla hemen yeni hesap açılıp ikinci kez oy verilmesini
          önlemek için numaranın geri döndürülemez anahtarlı özeti <strong>30 gün</strong>{" "}
          tutulur ve süre sonunda silinir.
        </li>
        <li>SMS kodları en geç 2 gün, kötüye kullanım sayaçları en geç 2 gün içinde silinir.</li>
        <li>Site içi bildirimler 90 gün sonra silinir. Hesap silinince bildirimlerin, rozetlerin ve profil bilgilerin de silinir.</li>
      </ul>
      <h2>Haklarınız</h2>
      <p>
        Kanun md. 11 kapsamında bilgi talep etme, düzeltme, silme ve itiraz haklarına sahipsin.
        Hesabını <Link className="underline" href="/hesap">Hesabım</Link> sayfasından
        silebilirsin. Eski e-posta sayımına katıldıysan{" "}
        <Link className="underline" href="/sil-verilerim">eski kaydını sil</Link>.
      </p>
      <h2>Çerezler</h2>
      <p>
        Yalnızca oturum ve kayıt adımı için zorunlu çerezler kullanılır. Analitik veya reklam
        çerezi kullanılmaz.
      </p>
    </LegalPage>
  );
}
