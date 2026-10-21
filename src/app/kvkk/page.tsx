import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { COOKIE_POLICY, LEGAL_DOCS, LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Bizim Tribün",
  description: "Bizim Tribün'ün kişisel verileri hangi amaçla, hangi hukuki sebeple ve ne kadar süre işlediği.",
  alternates: { canonical: "/kvkk" },
};

export default function KvkkPage() {
  const v = LEGAL_DOCS.privacy.version;
  return (
    <LegalPage kicker={`KVKK • AYDINLATMA METNİ • SÜRÜM ${v}`} title="KİŞİSEL VERİLERİN İŞLENMESİ HAKKINDA AYDINLATMA METNİ">
      <p>
        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) md. 10 ve Aydınlatma
        Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, Bizim
        Tribün üyelerini ve ziyaretçilerini bilgilendirmek için hazırlanmıştır. Bu metin bir rıza metni
        değildir. Üyelik ve hizmetin sunulması için açık rızana dayanmıyoruz.
      </p>

      <h2>1. Veri sorumlusu</h2>
      <p>
        {LEGAL_ENTITY.name}
        <br />
        Adres: {LEGAL_ENTITY.address}
        <br />
        MERSİS No: {LEGAL_ENTITY.mersis} • Vergi No: {LEGAL_ENTITY.taxNo}
        <br />
        E-posta: {LEGAL_ENTITY.email} • KEP: {LEGAL_ENTITY.kep}
        <br />
        VERBİS: {LEGAL_ENTITY.verbis}
      </p>

      <h2>2. İşlenen kişisel veriler, amaçları ve hukuki sebepleri</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Veri</th>
              <th>Amaç</th>
              <th>Hukuki sebep (KVKK md. 5/2)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>İletişim:</strong> e-posta adresi, cep telefonu numarası
              </td>
              <td>
                E-posta (ya da SMS) koduyla üyelik ve giriş, bir adrese ya da numaraya tek hesap kuralı,
                hesabınla ilgili iletişim. Profilde ve herkese açık alanlarda gösterilmez. Moderatörler
                yalnızca maskeli hâlini görür. Tamamını yalnızca yetkili yöneticiler görebilir.
              </td>
              <td>(c) sözleşmenin kurulması ve ifası</td>
            </tr>
            <tr>
              <td>
                <strong>Kimlik:</strong> takma ad (kullanıcı adı)
              </td>
              <td>Seni tribünlerde ve profilinde göstermek. Sitede görünen tek kimliğin budur.</td>
              <td>(c) sözleşmenin kurulması ve ifası</td>
            </tr>
            <tr>
              <td>
                <strong>Kimlik:</strong> ad, soyad, doğum tarihi
              </td>
              <td>
                Yaş sınırını uygulamak, hesap sahipliğiyle ilgili başvurularda ve uyuşmazlıklarda seni
                tanımak. Hiçbir yerde herkese açık gösterilmez; yalnızca yetkili yöneticiler görebilir.
              </td>
              <td>(c) sözleşmenin kurulması ve ifası; (e) bir hakkın tesisi, kullanılması veya korunması</td>
            </tr>
            <tr>
              <td>
                <strong>Pazarlama:</strong> cep telefonu numarası, kampanya izninin verildiği tarih
              </td>
              <td>
                Yalnızca ayrıca izin verdiysen, Bizim Tribün&apos;e özel fırsat ve kampanyalardan SMS ile
                haberdar etmek. İzin üyeliğin şartı değildir; Hesabım sayfasından istediğin zaman geri
                alabilirsin.
              </td>
              <td>Açık rıza (KVKK md. 5/1) ve 6563 sayılı Kanun kapsamında ticari elektronik ileti onayı</td>
            </tr>
            <tr>
              <td>
                <strong>Üyelik işlemleri:</strong> takım tercihi (oy), isteğe bağlı il, profil (kısa
                tanıtım, hazır avatar, görünürlük tercihi), bildirim tercihleri
              </td>
              <td>
                Taraftar sayımı, il sıralamaları, takım tribününe erişim, profil ve site içi
                bildirimler. İl, konumundan ya da IP adresinden tahmin edilmez.
              </td>
              <td>(c) sözleşmenin kurulması ve ifası</td>
            </tr>
            <tr>
              <td>
                <strong>Tribün içerikleri:</strong> konular, yorumlar, beğeniler, bildirimlerin
                (raporların), engellediğin üyeler, katkı rozetleri
              </td>
              <td>Topluluk hizmetini sunmak ve moderasyon. Raporların yalnızca moderatörlere görünür.</td>
              <td>(c) sözleşmenin ifası; (f) meşru menfaat (topluluk güvenliği)</td>
            </tr>
            <tr>
              <td>
                <strong>İşlem güvenliği:</strong> oturum kayıtları, doğrulama kodlarının geri
                döndürülemez özetleri, IP adresi ve tarayıcı bilgisinin anahtarlı özetleri (HMAC),
                cihaz çerezindeki rastgele kimliğin anahtarlı özeti ve hesap açılış tarihi, yöneticiler
                için iki adımlı doğrulama bilgileri
              </td>
              <td>
                Hesap güvenliği, bot ve kötüye kullanım koruması, deneme sınırları, aynı cihazdan çok
                sayıda hesap açılarak sayımın çarpıtılmasını önlemek. Cihaz özeti hesabınla
                ilişkilendirilmez. Ham IP adresi ve doğrulama kodu saklanmaz, kayıtlara yazılmaz.
              </td>
              <td>(f) meşru menfaat; (ç) hukuki yükümlülük</td>
            </tr>
            <tr>
              <td>
                <strong>Hukuki işlem:</strong> Kullanım Koşulları ve Aydınlatma Metni onay kayıtları
                (sürüm ve tarih), moderasyon ve yönetici işlem kayıtları, silinen hesabın telefon
                numarasının ya da e-posta adresinin anahtarlı özeti
              </td>
              <td>
                Hangi metni ne zaman onayladığını ispat etmek, yönetici işlemlerini denetlemek, silip
                yeniden kayıt olarak sayımın ya da banın aşılmasını önlemek.
              </td>
              <td>(e) bir hakkın tesisi, kullanılması veya korunması; (f) meşru menfaat</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Özel nitelikli kişisel veri (sağlık, din, siyasi görüş, dernek üyeliği vb.) istemiyoruz. Takım
        tercihi bu kapsamda değildir. Tribünlerde kendi ya da başkasının özel nitelikli verisini
        paylaşmaman gerekir.
      </p>

      <h2>3. Toplama yöntemi</h2>
      <p>
        Veriler, üyelik ve tribün formlarına senin girdiğin bilgilerden ve siteyi kullanırken oluşan
        oturum ve güvenlik kayıtlarından elektronik ortamda, otomatik yollarla toplanır. Kullanılan
        çerezler{" "}
        <Link className="underline" href={COOKIE_POLICY.path}>
          Çerez Politikası
        </Link>
        &apos;nda yazılıdır.
      </p>

      <h2>4. Kimlere aktarılır?</h2>
      <ul>
        <li>
          <strong>SMS sağlayıcısı:</strong> SMS doğrulaması kullanıldığında, kodu iletmek için
          telefon numaran ve kod SMS sağlayıcısına iletilir: Netgsm (Türkiye) veya Twilio Inc. (ABD).
          Hangisinin kullanıldığı: [KULLANILAN SMS SAĞLAYICISI].
        </li>
        <li>
          <strong>Bot koruması:</strong> Doğrulama kodu istenmeden önce, tarayıcı ve IP bilgilerin Cloudflare
          Turnstile (Cloudflare Inc., ABD) tarafından bot kontrolü için işlenir.
        </li>
        <li>
          <strong>E-posta altyapısı:</strong> Doğrulama kodu ve hesap e-postalarını iletmek için
          e-posta adresin ve mailin içeriği Resend (Resend Inc., ABD) üzerinden gönderilir.
        </li>
        <li>
          <strong>İleti Yönetim Sistemi (İYS):</strong> Kampanya SMS&apos;i iznini verdiysen,
          numaran ve iznin yasal zorunluluk gereği İYS&apos;ye bildirilir.
        </li>
        <li>
          <strong>Barındırma:</strong> Veriler {"[SUNUCU / BARINDIRMA SAĞLAYICISI VE ÜLKESİ]"} üzerinde
          saklanır.
        </li>
        <li>
          <strong>Yetkili kurumlar:</strong> Kanunen yetkili kamu kurum ve kuruluşları ile mahkemelere,
          talep edildiğinde ve hukuki yükümlülük kapsamında.
        </li>
      </ul>
      <p>
        <strong>Yurt dışına aktarım:</strong> ABD&apos;deki sağlayıcılara yapılan aktarımlar KVKK md. 9
        uyarınca, Kişisel Verileri Koruma Kurulu&apos;nun ilan ettiği standart sözleşmenin sağlayıcıyla
        imzalanması ve Kurum&apos;a bildirilmesi yoluyla yapılır: [STANDART SÖZLEŞME VE BİLDİRİM
        DURUMU]. Verilerin satılmaz, reklam amacıyla paylaşılmaz.
      </p>

      <h2>5. Saklama süreleri</h2>
      <ul>
        <li>Hesap verileri: hesap açık olduğu sürece.</li>
        <li>
          Doğrulama kodlarının özetleri ve deneme sınırı sayaçları: en geç 2 gün. Kayıt bileti: 15
          dakika.
        </li>
        <li>Cihaz kimliği özeti ve hesap açılış tarihi: 1 yıl, sonra otomatik silinir.</li>
        <li>Kampanya izni: geri alınana ya da hesap silinene kadar.</li>
        <li>
          Oturum kayıtları: oturum sona erdikten ya da kapatıldıktan 30 gün sonra silinir. Üye
          oturumu en fazla 30 gün, yönetici oturumu en fazla 8 saat sürer.
        </li>
        <li>IP ve tarayıcı özetli güvenlik kayıtları: 1 yıl.</li>
        <li>Site içi bildirimler: 90 gün.</li>
        <li>
          Hesap silindiğinde telefon, e-posta, ad-soyad, doğum tarihi, il, profil bilgileri,
          bildirimler ve rozetler silinir. Takım oyu sayımdan çıkarılır, anonim hesap numarasıyla kayıtta
          kalır. Silmediğin tribün yazıları &quot;Silinmiş üye&quot; adıyla kalır.
        </li>
        <li>
          Silinen hesabın telefon numarasının ya da e-posta adresinin kendisi değil, geri
          döndürülemez anahtarlı özeti tutulur. Oy vermemiş hesaplarda <strong>30 gün</strong>, oy vermiş hesaplarda{" "}
          <strong>1 yıl</strong> sonra silinir. Topluluk kuralları nedeniyle banlıyken silinen
          hesaplarda bu özet süresiz tutulur ve o numara ya da adresle yeniden üye olunamaz.
        </li>
        <li>Onay kayıtları: hesap silindikten sonra 10 yıl (genel zamanaşımı süresi).</li>
        <li>
          Moderasyon ve yönetici işlem kayıtları: değiştirilemez şekilde tutulur. Silinen hesaplarda
          yalnızca anonim hesap numarasına bağlı kalır. Saklama süresi: [SÜRE].
        </li>
      </ul>
      <p>Süresi dolan veriler otomatik olarak silinir veya anonim hâle getirilir.</p>

      <h2>6. Haklarınız (KVKK md. 11)</h2>
      <p>Veri sorumlusuna başvurarak şunları yapabilirsin:</p>
      <ul>
        <li>Kişisel verilerinin işlenip işlenmediğini öğrenmek ve işlenmişse bilgi istemek;</li>
        <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek;</li>
        <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilmek;</li>
        <li>Eksik veya yanlış işlenmişse düzeltilmesini istemek;</li>
        <li>KVKK md. 7 şartlarıyla silinmesini veya yok edilmesini istemek;</li>
        <li>Düzeltme ve silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini istemek;</li>
        <li>
          Yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonuç çıkmasına itiraz
          etmek;
        </li>
        <li>Kanuna aykırı işleme nedeniyle zarara uğrarsan zararın giderilmesini talep etmek.</li>
      </ul>

      <h2>7. Nasıl başvurursun?</h2>
      <ul>
        <li>
          Hesabını ve verilerini{" "}
          <Link className="underline" href="/hesap">
            Hesabım
          </Link>{" "}
          sayfasından kendin silebilirsin. Eski e-posta sayımına katıldıysan{" "}
          <Link className="underline" href="/sil-verilerim">
            eski kaydını sil
          </Link>
          .
        </li>
        <li>
          Diğer talepler için Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ&apos;e uygun
          olarak yazılı başvuruyu {LEGAL_ENTITY.address} adresine, ya da KEP ({LEGAL_ENTITY.kep}),
          güvenli elektronik imza, mobil imza veya {LEGAL_ENTITY.email} adresine gönderebilirsin.
          Başvuruda ad-soyad, imza (yazılı başvuruda), adres, iletişim bilgisi ve talebin yer almalıdır.
          Kimliğini doğrulamak için hesabına kayıtlı e-posta adresini ya da telefon numarasını
          belirtmen gerekir.
        </li>
        <li>
          Başvurun en geç 30 gün içinde ücretsiz sonuçlandırılır. İşlem ayrıca bir maliyet
          gerektirirse Kurul&apos;un belirlediği tarifedeki ücret alınabilir.
        </li>
        <li>
          Başvurun reddedilir, cevabı yetersiz bulursan ya da süresinde cevap verilmezse cevabı
          öğrendiğin tarihten itibaren 30 gün, her hâlde başvuru tarihinden itibaren 60 gün içinde
          Kişisel Verileri Koruma Kurulu&apos;na şikâyette bulunabilirsin.
        </li>
      </ul>

      <h2>8. Değişiklikler</h2>
      <p>
        Bu metnin her sürümü bir tarihle numaralandırılır (şu anki sürüm: {v}). Metin değiştiğinde giriş
        yapmış üyelere yeni sürüm gösterilir ve okuduklarını onaylamaları istenir.
      </p>
    </LegalPage>
  );
}
