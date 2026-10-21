import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { LEGAL_DOCS, LEGAL_ENTITY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Bizim Tribün",
  description: "Bizim Tribün üyelik, takım seçimi, forum kuralları ve sorumluluklar.",
  alternates: { canonical: "/kullanim-kosullari" },
};

export default function TermsPage() {
  const v = LEGAL_DOCS.terms.version;
  return (
    <LegalPage kicker={`KULLANIM KOŞULLARI • SÜRÜM ${v}`} title="KULLANIM KOŞULLARI">
      <h2>1. Taraflar ve kapsam</h2>
      <p>
        Bu koşullar, {LEGAL_ENTITY.name} ({LEGAL_ENTITY.address}, MERSİS No: {LEGAL_ENTITY.mersis}) tarafından
        işletilen Bizim Tribün internet sitesini (&quot;Platform&quot;) kullanan herkes için geçerlidir.
        Üye olurken bu koşulları kabul etmiş olursun. Kabul etmiyorsan üye olma ve Platform&apos;u
        üye olarak kullanma.
      </p>
      <p>
        Bizim Tribün bağımsız bir taraftar platformudur. Hiçbir kulüp, federasyon veya lig ile resmi
        bağı yoktur. Kulüp adları sahiplerine aittir ve yalnızca taraftarların takımını göstermek için
        kullanılır.
      </p>

      <h2>2. Üyelik şartları</h2>
      <ul>
        <li>
          <strong>Yaş:</strong> 18 yaşını doldurmuş olman gerekir. 13–17 yaş arasındaysan ancak velinin
          ya da vasinin izniyle üye olabilirsin. 13 yaşından küçükler üye olamaz. Yaş sınırına aykırı
          açıldığı anlaşılan hesaplar kapatılır.
        </li>
        <li>
          <strong>Tek hesap:</strong> Her hesap, SMS koduyla doğrulanmış ve sana ait bir cep telefonu
          numarasına bağlıdır. Bir numarayla aynı anda yalnızca bir hesap açılabilir. Başkasının
          numarasını kullanmak yasaktır.
        </li>
        <li>
          <strong>Hesap güvenliği:</strong> Hesabına giriş SMS koduyla yapılır. Kodu kimseyle paylaşma.
          Hesabından yapılan işlemlerden sen sorumlusun. Yetkisiz kullanım fark edersen bize hemen bildir.
        </li>
        <li>
          <strong>Kullanıcı adı:</strong> Başkası gibi, Platform yönetimi gibi ya da hakaret içeren bir
          ad seçemezsin. Bu tür adlar değiştirilebilir veya hesap kapatılabilir.
        </li>
      </ul>

      <h2>3. Takım seçimi ve taraftar sayımı</h2>
      <ul>
        <li>
          Her hesap yalnızca bir takımı temsil eder. Onayladığın takım seçimi <strong>kalıcıdır</strong>:
          değiştirilemez, başka bir takıma taşınamaz.
        </li>
        <li>
          Sayımlar, SMS ile doğrulanmış telefon numaralarının tercihlerini gösterir. Bir kişinin kimliğini
          kesin olarak kanıtlamaz, resmi bir istatistik ya da anket değildir.
        </li>
        <li>
          Hesabını silersen oyun sayımdan düşer. Aynı numarayla yeniden üye olabilmek için beklenmesi
          gereken süreler{" "}
          <Link className="underline" href="/kvkk">
            Aydınlatma Metni
          </Link>
          &apos;nde yazılıdır.
        </li>
        <li>
          Sahte hesapla, otomatik araçla ya da başkasının numarasıyla verildiği anlaşılan oylar,
          gerekçesi kaydedilerek sayımdan çıkarılabilir.
        </li>
        <li>İl seçimi isteğe bağlıdır. İlin konumundan ya da IP adresinden tahmin edilmez.</li>
      </ul>

      <h2>4. Tribün (forum) kuralları</h2>
      <p>Takım tribünlerine yalnızca o takımı seçmiş üyeler girebilir. Aşağıdakiler her tribünde yasaktır:</p>
      <ul>
        <li>Hakaret, küfür, aşağılama, tehdit, taciz ve şiddete çağrı;</li>
        <li>Irk, etnik köken, din, cinsiyet, engellilik gibi nedenlerle ayrımcılık ve nefret söylemi;</li>
        <li>
          Başkasının kişisel verilerini (telefon, adres, kimlik, fotoğraf vb.) izinsiz paylaşmak; özel
          nitelikli kişisel verilerini (sağlık, inanç vb.) paylaşmak;
        </li>
        <li>Telif hakkıyla korunan içeriği izinsiz paylaşmak, korsan yayın bağlantısı vermek;</li>
        <li>Yasa dışı bahis, kumar, dolandırıcılık veya her türlü reklam ve spam;</li>
        <li>Müstehcen içerik, suç işlemeye özendirme ve kanunlara aykırı diğer her türlü içerik;</li>
        <li>Kendini başka biri, bir kulüp yetkilisi ya da Platform yönetimi gibi göstermek;</li>
        <li>Sayımı veya beğenileri manipüle etmeye yönelik toplu ya da otomatik işlemler.</li>
      </ul>

      <h2>5. İçeriğin sorumluluğu ve kullanım izni</h2>
      <p>
        Paylaştığın yazıların hukuki sorumluluğu sana aittir. İçeriklerin üzerindeki haklar sende kalır.
        Paylaştığın içeriği Platform&apos;da göstermemiz, saklamamız ve teknik olarak işlememiz için bize
        ücretsiz ve münhasır olmayan bir kullanım izni verirsin. Bu izin, içeriği sildiğinde sona erer.
        Ancak yasal yükümlülükler ve moderasyon kayıtları için gereken kopyalar saklanabilir.
      </p>
      <p>
        Hesabını silmeden önce yazılarını kendin silebilirsin. Hesabını sildiğinde silmediğin yazılar,
        tartışmaların bütünlüğü için &quot;Silinmiş üye&quot; adıyla kalır.
      </p>

      <h2>6. Moderasyon ve yaptırımlar</h2>
      <p>
        Kurallara aykırı içerikler kaldırılabilir ya da yayından önce onaya alınabilir. Hesaplar
        geçici veya kalıcı olarak kısıtlanabilir, kurallara aykırı oylar sayımdan çıkarılabilir. Her
        yönetici işlemi gerekçesiyle kayda geçer. Bir karara itiraz etmek için {LEGAL_ENTITY.email}{" "}
        adresine yazabilirsin.
      </p>

      <h2>7. Yer sağlayıcı olarak sorumluluğumuz</h2>
      <p>
        Platform, 5651 sayılı Kanun kapsamında üyelerin içeriklerine yer sağlayıcıdır. İçerikleri
        yayından önce kontrol etme yükümlülüğümüz yoktur. Hukuka aykırı olduğunu düşündüğün bir içeriği
        sitedeki &quot;Bildir&quot; düğmesiyle ya da {LEGAL_ENTITY.email} adresinden bize bildirebilirsin.
        Haberdar olduğumuz hukuka aykırı içerikleri ve mahkeme ya da yetkili makam kararlarını
        mevzuata uygun şekilde yerine getiririz.
      </p>

      <h2>8. Hizmetin niteliği</h2>
      <ul>
        <li>Platform ücretsizdir. Ücretli bir özellik eklenirse önceden ayrı koşullarla duyurulur.</li>
        <li>
          Hizmeti geliştirmek, bakım yapmak ya da güvenlik nedeniyle özellikleri değiştirebilir veya
          geçici olarak durdurabiliriz.
        </li>
        <li>
          Kanunun izin verdiği ölçüde, üyelerin içeriklerinden ve kesintilerden doğan dolaylı
          zararlardan sorumlu değiliz. Bu hüküm, tüketici olarak sahip olduğun yasal hakları sınırlamaz.
        </li>
      </ul>

      <h2>9. Hesabın kapatılması</h2>
      <p>
        Hesabını istediğin zaman{" "}
        <Link className="underline" href="/hesap">
          Hesabım
        </Link>{" "}
        sayfasından silebilirsin. Bu koşullara ciddi veya tekrarlayan şekilde aykırı davranan hesapları
        kapatabiliriz.
      </p>

      <h2>10. Koşullardaki değişiklikler</h2>
      <p>
        Bu metnin her sürümü bir tarihle numaralandırılır (şu anki sürüm: {v}). Önemli bir değişiklik
        olduğunda giriş yapmış üyelere yeni sürüm gösterilir. Onaylamadan tribünlerde yazılamaz. Hangi
        sürümü ne zaman onayladığın kayıt altında tutulur.
      </p>

      <h2>11. Uygulanacak hukuk ve uyuşmazlıklar</h2>
      <p>
        Bu koşullara Türk hukuku uygulanır. Tüketici sıfatıyla başvurularında 6502 sayılı Kanun
        uyarınca yerleşim yerindeki tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir. Diğer
        uyuşmazlıklarda {LEGAL_ENTITY.court} yetkilidir.
      </p>

      <h2>12. İletişim</h2>
      <p>
        {LEGAL_ENTITY.name} • {LEGAL_ENTITY.address} • E-posta: {LEGAL_ENTITY.email} • KEP:{" "}
        {LEGAL_ENTITY.kep}
      </p>
    </LegalPage>
  );
}
