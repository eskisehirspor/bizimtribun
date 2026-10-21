# Bizim Tribün

Türkiye'nin il bazında taraftar sayımı ve taraftar forumu. Next.js 16 + SQLite (`better-sqlite3`).

- Üyelik ve giriş e-posta koduyla (`VERIFY_CHANNEL=sms` ile SMS koduna geçer); aynı tarayıcıdan en fazla 2 hesap açılır; her hesap bir kez, kalıcı olarak bir takıma oy verir (veritabanı tetikleyicileriyle korunur).
- Sayaçlar yalnızca aktif `fan_votes` kayıtlarından gelir; 81 il haritası, il ve takım sayfaları, eşitlikler eşitlik olarak gösterilir.
- Forum: Milli Takım Tribünü (herkese açık, eski Genel Tribün), takım tribünleri (haftanın taraftarı meşalesiyle), Maç Günü kategorisi; beğeni, bildirim (site içi), rapor, engelleme.
- Profil (`/u/<kullanıcı>`), rozetler ve katkı puanı (oylarla ilgisi yok).
- Yönetim paneli: üyeler, roller, takım/lig/sezon, moderasyon, raporlar, site ayarları, bakım modu, denetim kaydı.

Belgeler: [üretim](docs/production.md) · [veri ve KVKK kuralları](docs/data-policy.md) · [roller ve panel](docs/admin.md) · [ilk süper admin](docs/admin-bootstrap.md)

## Başka bir bilgisayarda çalıştırma

```bash
git clone https://github.com/eskisehirspor/bizimtribun.git
cd bizimtribun
git fetch origin claude/production-platform-qhdqfe
git checkout claude/production-platform-qhdqfe
npm ci
cp .env.example .env.local     # RESEND_API_KEY boşken kod ekranda görünür, mail gitmez
npm run dev                    # http://localhost:3000
```

Node.js 20.9 veya üstü gerekir. Geliştirme veritabanı `data/` altında oluşur.

## Kontroller

```bash
npm test                      # birim + HTTP entegrasyon testleri (geçici SQLite dosyaları)
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```
