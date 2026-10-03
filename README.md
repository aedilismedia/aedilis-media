# Aedilis Media web sitesi

Düz HTML üreten, GitHub'dan yönetilen statik site. İçerik JSON ve Markdown dosyalarında durur; `main` dalına push'ladığında GitHub Actions siteyi derleyip GitHub Pages'e yayınlar. WordPress, veritabanı ve eklenti yok.

## İçeriği nasıl güncellersin

| Ne | Hangi dosya |
| --- | --- |
| Yeni şarkı, EP ya da albüm | `data/releases.json` (en üste yeni bir blok ekle, `"latest": true` yalnızca son yayında kalsın) |
| Bölümler, seriler, proje metinleri | `data/divisions.json` |
| Slogan, hero metni, iletişim, sosyal bağlantılar, abone sayısı | `data/site.json` |
| DZS sayfası | `data/dzs.json` |
| Günlük yazısı | `content/journal/yazi-adi.md` (Markdown; başlıkta `title`, `category`, `excerpt`, `order` alanları) |
| Son videolar | Otomatik: her gün YouTube'dan çekilir. Elle düzenlemek için `data/videos.json` |

Günlük yazısının metni boşsa kart sitede görünür ama tıklanmaz. Metni ekleyince yazının kendi sayfası otomatik oluşur. `draft: true` yazarsan yazı hiç yayınlanmaz.

## Yerelde çalıştırma

```
npm install
npm run dev      # derler ve http://localhost:4173 adresinde açar
npm run build    # yalnızca dist/ klasörünü üretir
```

Node 20 ya da üstü gerekir.

## GitHub'da yayınlama (bir kez yapılır)

1. GitHub'da boş bir repo oluştur (ör. `aedilis-media`) ve bu klasörü içine push'la.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `main`'e ilk push'ta "Siteyi yayınla" workflow'u çalışır. Adres `https://KULLANICI.github.io/aedilis-media/` olur.
4. Alt klasörde (`/aedilis-media/`) yayınlıyorsan `data/site.json` içinde `"basePath": "/aedilis-media/"` yaz. Kendi alan adında kök dizindeyse `"/"` kalır.

### aedilismedia.com'u bağlamak

Önce yeni siteyi GitHub adresinde kontrol et, sonra:

1. Settings → Pages → **Custom domain** alanına `aedilismedia.com` yaz.
2. Hostinger'da alan adının DNS kayıtlarını GitHub Pages'e yönlendir: `@` için dört A kaydı (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) ve `www` için `KULLANICI.github.io` değerli bir CNAME. Güncel değerleri GitHub'un [özel alan adı rehberinden](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site) doğrula.
3. DNS yayılınca Pages ayarında **Enforce HTTPS** kutusunu işaretle.

Bu adım alan adını WordPress'ten ayırır. E-posta (`@aedilismedia.com`) Hostinger'da kalıyorsa MX kayıtlarına dokunma.

## İletişim formu

Statik sitede form verisini alacak bir sunucu yok. İki seçenek:

- **Varsayılan:** Form, ziyaretçinin e-posta uygulamasını hazır bir taslakla açar (`mailto:`).
- **Uç nokta:** Formspree gibi bir servise kayıt olup form adresini `data/site.json` → `contact.formEndpoint` alanına yaz. Form o zaman mesajı sayfadan ayrılmadan gönderir.

## Görseller

Üç bölüm logosu (`assets/img/`) vault'taki orijinallerden üretildi. Proje logoları ve site ikonu şimdilik eski WordPress adresinden yükleniyor (`data/divisions.json` ve `data/site.json` içinde `https://aedilismedia.com/wp-content/...`). WordPress'i kapatmadan önce bunları `assets/img/` içine kopyalayıp yolları `assets/img/dosya.webp` olarak değiştir.

## Yapı

```
data/            içerik (JSON)
content/journal/ günlük yazıları (Markdown)
assets/          CSS, JS, görseller (yazı tipleri build sırasında eklenir)
scripts/         YouTube video çekici
build.mjs        tüm HTML'i üreten tek betik
.github/workflows/deploy.yml
```
