import Link from "next/link";

export default function KvkkPage() {
  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg px-4 py-10">
      <article className="max-w-[720px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-6 md:p-8">
        <p className="font-mono text-[10px] tracking-[0.2em]">KVKK • AYDINLATMA METNİ v2026-09-02</p>
        <h1 className="font-anton text-[36px] leading-[0.9] mt-2">VERİ SAHİBİNİ AYDINLATMA</h1>
        <div className="font-mono text-[13px] leading-[1.5] mt-5 space-y-4">
          <p>
            <strong>Veri sorumlusu:</strong> Bizim Tribün projesi (taraftar sayımı
            amaçlı bağımsız platform). İletişim: site üzerindeki silme formu.
          </p>
          <p>
            <strong>Amaç:</strong> Türkiye’de hangi tribünün daha büyük olduğunu,
            bağırışla değil doğrulanmış kayıtla ölçmek.
          </p>
          <p>
            <strong>İşlenen veriler:</strong> ad, soyad, telefon, e-posta, seçilen
            takım, il, açık rıza kaydı. IP ve cihaz izi ham saklanmaz; HMAC ile
            hash’lenir. Çift oyu engellemek için e-posta ve telefonun geri
            döndürülemez HMAC izi de tutulur; bu izlerden açık iletişim bilgisi
            üretilemez.
          </p>
          <p>
            <strong>Hukuki sebep:</strong> 6698 sayılı Kanun md. 5/1 açık rıza.
            Rıza vermezsen kayıt oluşmaz.
          </p>
          <p>
            <strong>Aktarım:</strong> E-posta gönderimi için kullanırsak yalnızca
            mail altyapısı (ör. Resend). Satılmaz, reklam ağına verilmez.
          </p>
          <p>
            <strong>Saklama:</strong> Sayım sürdüğü sürece. Silme talebinden sonra
            ad, soyad, e-posta, telefon ve diğer açık PII silinir; mühür sayımdan
            düşer. Aynı kişinin yeniden oy vermesini önlemek için yalnızca
            geri döndürülemez e-posta/telefon HMAC izleri kalır.
          </p>
          <p>
            <strong>Üyelik hesabı:</strong> Forum ve oturum için kullanıcı adı,
            ad, soyad, doğum tarihi, telefon, e-posta, il ve tuttuğun takım
            alınır. Kullanıcı adı tribünde görünebilir. Ad, soyad, telefon,
            e-posta ve doğum tarihi forum profilinde public değildir. Üyelik
            telefonu sayım OTP’sinden ayrıdır; üyelik kaydı SMS göndermez.
          </p>
          <p>
            <strong>Hakların:</strong> Kanun md. 11 kapsamındaki erişim, düzeltme,
            silme, rızayı geri çekme hakların vardır.{" "}
            <Link className="underline" href="/sil-verilerim">
              Verilerimi sil
            </Link>
            .
          </p>
        </div>
        <Link href="/" className="mt-6 inline-block font-anton bg-black text-white px-4 py-2">
          GERİ
        </Link>
      </article>
    </main>
  );
}
