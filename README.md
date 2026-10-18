# SurgiPlan

2022'de özel bir hastane için yazmıştım, ayın olmadığı zamanlardı 😅 Uzun süre özel depoda bekledi; belki birine faydası dokunur diye paylaşmaya karar verdim. Kodlar tamamen bana ait.

---

Orta ölçekli bir hastane için ameliyathane planlama sistemi. Cerrahlar vaka talebi açar, ameliyathane koordinatörü talepleri sürükle-bırak takvimde salonlara yerleştirir, ekip e-posta ve uygulama içi bildirimle haberdar olur. Bir salonu, bir kişiyi ya da bir ekipmanı aynı anda iki yere koyacak her planlama sistem tarafından reddedilir.

![Ameliyat takvimi](docs/screenshots/03-takvim.png)

## İçindekiler

- [Özellikler](#özellikler)
- [Roller ve yetkiler](#roller-ve-yetkiler)
- [Nasıl kullanılır](#nasıl-kullanılır)
- [E-posta bildirimleri](#e-posta-bildirimleri)
- [Ekran görüntüleri](#ekran-görüntüleri)
- [Kurulum](#kurulum)
- [Teknik yapı](#teknik-yapı)

## Özellikler

- **Ameliyat takvimi:** Salon × saat ızgarası; her vakadan sonra salonun temizlik süresi taralı alan olarak gösterilir. Koordinatör bekleyen talepleri ya da mevcut vakaları sürükleyip bırakır, bırakmadan önce hedef saatin uygun olup olmadığını görür.
- **Çakışma kontrolü:** Salon, operatör, anestezi uzmanı, ekip üyeleri, ekipman adedi, izin/nöbet kayıtları, temizlik süresi ve mesai saatleri birlikte kontrol edilir. İki koordinatör aynı anda aynı salona vaka koymaya çalışsa bile çift kayıt oluşmaz.
- **Talep akışı:** Taslak → Onay bekliyor → Planlandı → Hasta hazırlanıyor → Ameliyatta → Tamamlandı. Erteleme ve iptal gerekçe ister, gerekçeler raporlara yansır.
- **Güvenli cerrahi kontrol listesi:** DSÖ listesine göre Giriş, Mola ve Çıkış aşamaları. Liste tamamlanmadan ameliyat başlatılamaz ya da bitirilemez.
- **Canlı pano:** Koridor ekranları için tam ekran görünüm. Değişiklikler anında yansır, hasta adları yalnızca baş harflerle gösterilir.
- **Süre tahmini:** Yeni talepte süre, cerrahın aynı işlemdeki son vakalarından önerilir.
- **Raporlar:** Salon doluluğu, ilk vakanın zamanında başlama oranı, iptal/erteleme nedenleri, tahmini ve gerçek süre karşılaştırması. CSV olarak indirilebilir.
- **Yönetim:** Kullanıcılar e-postayla davet edilir. Salon, ekipman ve işlem kataloğu yönetimi. Denetim izi.
- Açık ve koyu tema; tablet ve telefonda da kullanılabilir.

## Roller ve yetkiler

| Rol | Ne yapar |
|---|---|
| **Sistem Yöneticisi** | Kullanıcıları davet eder, rollerini ve branşlarını düzenler, kilitli hesapları açar. Salon, ekipman ve işlem kataloğunu yönetir. Denetim izini görür. |
| **Ameliyathane Koordinatörü** | Talepleri onaylar ve takvimde salonlara yerleştirir. Vakaları taşır, erteler ya da iptal eder. Ekibin izin kayıtlarını yönetir. Raporları görür. |
| **Cerrah** | Kendi vakaları için talep oluşturur ve onaya gönderir. Asistanının taslakları onaylar. Kendi vakalarını erteleyebilir veya iptal edebilir. |
| **Asistan Doktor** | Sorumlu hekim adına talep taslağı hazırlar; taslak cerrahın onayına gider. |
| **Anestezi Uzmanı** | Tüm vakaları görür. Kontrol listesini işaretler, vakayı başlatır ve bitirir. |
| **Sorumlu Hemşire** | Tüm vakaları görür. Kontrol listesini işaretler, vakayı başlatır ve bitirir. |
| **Sekreter** | Hasta kaydı açar, cerrah adına talep oluşturur, vakaları ve raporları görür. |

## Nasıl kullanılır

### 1. Talep oluşturma (cerrah, asistan, sekreter)

1. Üst menüden **Yeni Talep**'e tıklayın.
2. Hasta bilgisini girin; sistemde yoksa "Sistemde olmayan hasta ekle" ile kaydedin.
3. Branş, işlem, taraf, anestezi tipi, öncelik ve istenen tarihi seçin. Tahmini süre geçmişten otomatik gelir.
4. Ekip ve ekipman ekleyin.
5. **Onaya gönder** deyin. Asistanlar yalnızca taslak kaydedebilir; taslak cerrahın onayına düşer.

### 2. Planlama (koordinatör)

1. **Takvim** sayfasında bekleyen listeden kartı tutup ilgili salonun satırına sürükleyin.
2. Hedef alan yeşil (uygun), turuncu (uyarı) ya da kırmızı (çakışma) görünür.
3. Bıraktığınızda planlama penceresi açılır; saati ve anestezi uzmanını ayarlayın.
4. **Planla ve bildir** ile kaydedin. Ekip e-posta ve bildirim alır.

### 3. Ameliyat günü (hemşire, anestezi)

1. Vakayı açıp **Hazırlığa Al** deyin.
2. Giriş ve Mola kontrol listesi maddelerini işaretleyin; bunlar olmadan **Ameliyatı Başlat** çalışmaz.
3. Ameliyat bitince Çıkış maddelerini işaretleyip **Ameliyatı Bitir** deyin.

### 4. Erteleme ve iptal

**Ertele** ya da **İptal Et** butonları gerekçe ister. Ekibe e-posta gider.

### 5. İzin ve nöbet

**İzin / Nöbet** sayfasından izin veya nöbet ertesi günleri girin. Bu tarihlerde kişiye vaka planlanamazsa sistem engeller.

### 6. Yönetim

- **Kullanıcılar:** E-posta ile davet, 3 gün geçerli şifre belirleme bağlantısı.
- **Katalog:** Salonlar, ekipmanlar, işlem süreleri.
- **Denetim İzi:** Kim, ne zaman, neyi değiştirdi.

## E-posta bildirimleri

| Ne zaman | Kime |
|---|---|
| Kullanıcı davet edildiğinde | Davet edilen (şifre belirleme bağlantısı) |
| Şifre sıfırlama istendiğinde | Kullanıcı (1 saat geçerli) |
| Vaka planlandığında | Operatör, anestezi uzmanı ve ekip |
| Vakanın saati veya salonu değiştiğinde | Ekipteki herkes |
| Vaka ertelendiğinde / iptal edildiğinde | Ekipteki herkes (gerekçe ile) |
| Her gün 17:00 | Ertesi gün vakası olan herkes (günlük liste) |

Bildirimler **Profil ve ayarlar** sayfasından kapatılabilir. Geliştirme ortamında giden mailler MailHog'da görülür (http://localhost:8026).

## Ekran görüntüleri

| | |
|---|---|
| ![Giriş](docs/screenshots/01-giris.png) Giriş | ![Günlük durum](docs/screenshots/02-gunluk-durum.png) Günlük durum |
| ![Takvim](docs/screenshots/03-takvim.png) Ameliyat takvimi | ![Sürükle bırak](docs/screenshots/04-surukle-birak-cakisma.png) Çakışma kontrolü |
| ![Talepler](docs/screenshots/05-talepler.png) Talepler | ![Yeni talep](docs/screenshots/10-yeni-talep.png) Yeni talep |
| ![Vaka detayı](docs/screenshots/07-vaka-detay-kontrol-listesi.png) Vaka detayı ve kontrol listesi | ![Vakalarım](docs/screenshots/08-vakalarim.png) Vakalarım |
| ![Canlı pano](docs/screenshots/09-canli-pano.png) Canlı pano | ![Raporlar](docs/screenshots/06-raporlar.png) Raporlar |
| ![Kullanıcılar](docs/screenshots/11-kullanicilar.png) Kullanıcı yönetimi | ![Denetim izi](docs/screenshots/12-denetim-izi.png) Denetim izi |
| ![Koyu tema](docs/screenshots/13-koyu-tema.png) Koyu tema | ![E-posta](docs/screenshots/14-eposta-atama.png) Atama e-postası |

## Kurulum

Gereksinim: Docker.

```bash
cp .env.example .env
docker compose up -d --build
```

- Uygulama: http://localhost:8090
- Giden e-postalar (MailHog): http://localhost:8026

İlk açılışta veritabanı tabloları oluşturulur ve demo verisi yüklenir. Boş başlatmak için `.env` içinde `SEED_DEMO_DATA=false` yapın.

### Demo hesapları

Tüm hesapların şifresi: `Demo1234!`

| E-posta | Rol |
|---|---|
| koordinator@surgiplan.com | Ameliyathane Koordinatörü |
| cerrah@surgiplan.com | Cerrah |
| asistan@surgiplan.com | Asistan Doktor |
| anestezi@surgiplan.com | Anestezi Uzmanı |
| hemsire@surgiplan.com | Sorumlu Hemşire |
| sekreter@surgiplan.com | Sekreter |
| admin@surgiplan.com | Sistem Yöneticisi |

## Teknik yapı

```
apps/
  api/    NestJS 9, Prisma 4, SQL Server 2019, Socket.IO, Nodemailer
  web/    React 18, Vite 3, MUI 5, TanStack Query 4, React Hook Form, Recharts
packages/
  shared/ roller, izinler, durum makinesi, kontrol listesi
docs/adr/ mimari kararlar
```

| | |
|---|---|
| Runtime | Node.js 18, TypeScript 4.9, pnpm 7 |
| Auth | JWT (bellekte), rotating refresh token (httpOnly cookie) |
| Testler | Jest — çakışma motoru 19 birim test |
| Dağıtım | Docker Compose, nginx, GitHub Actions |

## Kapsam dışı

SurgiPlan bir planlama aracıdır; klinik kayıt tutmaz ve tıbbi cihaz değildir. Hastane bilgi sistemi entegrasyonu (HL7/FHIR) kapsam dışıdır.
