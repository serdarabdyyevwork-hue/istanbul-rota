# İstanbul Rota (deneme sürümü)

Telefona yüklenebilen bir web uygulaması (PWA). App Store veya Google Play gerekmez, komisyon yok.

**İçinde ne var**
- **Rotalar:** 4 hazır rota (Tarihi Yarımada, Galata–Beyoğlu, Kadıköy–Moda, Yeşil İstanbul).
- **Harita:** 22 yer ve pazarlar, kategori renkleriyle, Türkçe veya İngilizce yer isimleriyle. "Konumumu göster" düğmesi var. "Haritayı indir (50 MB)" düğmesiyle İstanbul haritası telefona kaydedilir ve **internetsiz çalışır**.
- **Ulaşım:** iki yer seç, taksi ücreti İBB tarifesiyle hesaplanır. Araba yakıt masrafı da gösterilir.
- **Pazarlar:** hangi gün nerede pazar kuruluyor. Bugün kurulanlar en üstte.
- **Dil:** Türkçe ve İngilizce.
- **Eksik bilgi bildir:** kullanıcı yazar, şimdilik telefonda saklanır.
- **İnternetsiz:** rotalar, ücretler ve pazarlar ilk açılıştan sonra internetsiz çalışır. Harita, "Haritayı indir" düğmesine bir kez basıldıktan sonra internetsiz çalışır.

## Bilgisayarında çalıştırmak

Bu klasörün içinde şunu çalıştır (Node.js gerekir, başka paket gerekmez):

```powershell
node tools/serve.mjs 8080
```

Sonra tarayıcıda `http://localhost:8080` adresini aç. Telefon görünümü için tarayıcının geliştirici araçlarında telefon modunu seç.

Python'un `http.server` komutunu kullanma. Harita dosyası parça parça okunur ve o sunucu bunu desteklemez.

## Bilgileri güncellemek

Uygulamanın kodu değişmeden, **sadece `data/istanbul.json` dosyası** düzenlenir. Uygulama internete bağlanınca yeni bilgiyi kendisi alır.

| Ne değişti? | Nereyi düzenle |
| --- | --- |
| Taksi tarifesi | `fares.taxi` → `start`, `perKm`, `perHourWait`, `min`, `checked` (kontrol tarihi) |
| Müze ücreti | İlgili yerin `fees` listesi. Resmî kaynaktan doğruladıysan `"verified": true` yap, sarı uyarı kalkar. |
| Yeni yer | `places` listesine ekle: `id`, `cat`, `district`, `lat`, `lng`, `name`, `note`, `fees` |
| Pazar günü | `markets` → `day` (0 = Pazar, 1 = Pazartesi … 6 = Cumartesi; bilinmiyorsa `null`) |
| Kontrol tarihi | En üstteki `updated` (YYYY-MM-DD) |

**Kirazlı pazarı örneği.** Pazarın perşembe kurulduğunu öğrendiysen `markets` içinde `"id": "kirazli"` satırını bul ve şunları yap:
- `"day": null` yerine `"day": 4` yaz.
- Konumu ekle: `"lat"` ve `"lng"`.
- Ne satıldığını `sells` alanına yaz.
- Kendin gördüysen `"verified": true` yap.

`index.html` veya `app.js` dosyasını değiştirirsen `sw.js` içindeki `CACHE = 'rota-v5'` değerini bir artır (`rota-v6`). Böylece telefonlar yeni sürümü alır. Kullanıcının indirdiği harita bu sırada silinmez, ayrı bir yerde (`rota-map-v1`) durur.

## Haritayı güncellemek (ayda bir yeterli)

Harita OpenStreetMap'ten Protomaps'in günlük derlemesi kesilerek yapıldı. Şu anki harita **24.11.2026** tarihli. Kapsadığı alan: boylam 28,55–29,35, enlem 40,85–41,25. Bu alan Kirazlı'dan Büyükada'ya ve Belgrad Ormanı'na kadar uzanıyor, Silivri ve Şile dışarıda kalıyor. Dosya 50 MB.

1. Protomaps'in resmî aracı `pmtiles.exe`'yi edin: [github.com/protomaps/go-pmtiles/releases](https://github.com/protomaps/go-pmtiles/releases) adresinden `Windows_x86_64.zip` dosyası. Sayfada yazan sha256 değeriyle kontrol et.
2. Yeni haritayı kes. Tarihi o günün tarihiyle değiştir:

```powershell
pmtiles.exe extract https://build.protomaps.com/20261224.pmtiles maps/istanbul.pmtiles --bbox=28.55,40.85,29.35,41.25 --maxzoom=15
```

3. `sw.js` içindeki `MAP_CACHE = 'rota-map-v1'` değerini ve `app.js` içindeki aynı değeri `rota-map-v2` yap. Böylece kullanıcılar yeni haritayı indirir.

Daha küçük bir dosya istersen `--maxzoom=14` kullan (yaklaşık 24 MB). Sokak isimleri yine görünür ama küçük sokaklar biraz daha az ayrıntılı olur.

## Ücretsiz yayınlamak (internete koymak)

İnternetsiz çalışma ve "telefona yükle" özelliği yalnızca **https** adreste çalışır. Ücretsiz seçenekler:
- **Cloudflare Pages** veya **Netlify**: hesap aç, bu klasörü sürükle bırak, sana `https://...` bir adres verir.
- **GitHub Pages**: klasörü bir GitHub deposuna koy ve Pages'i aç.

Kendi alan adını (örneğin `istanbulrota.com`) sonra bağlarsın. Yılda birkaç yüz TL tutar.

## Henüz yapılmayanlar (sıradaki adımlar)

1. ~~İnternetsiz harita~~ Tamamlandı (25.11.2026).
2. **Toplu taşıma ücretleri.** İstanbulkart tarifesi resmî kaynaktan eklenecek.
3. **Sarı işaretli fiyatlar.** Topkapı, Yerebatan, Galata Kulesi ve diğerleri resmî sitelerden (muze.gov.tr vb.) doğrulanacak.
4. **Daha fazla yer ve pazar.** İBB Açık Veri Portalı'ndan ve belediyelere yapılacak bilgi edinme başvurularıyla eklenecek.
5. **Bildirimlerin sunucuya gitmesi.** Ücretsiz bir veritabanına (örneğin Supabase) bağlanacak, sana tek listede gelecek.
6. **Ücretli şehir paketi.** Deneme döneminden sonra iyzico veya PayTR ile ödeme, KVKK ve mesafeli satış metinleri.
7. **Etkinlikler ve festivaller.** Belediye ve kültür merkezlerinin duyurularından haftalık güncelleme.

## Dosyalar

| Dosya | Ne işe yarar |
| --- | --- |
| `index.html` | Sayfa ve görünüm |
| `app.js` | Uygulamanın çalışması (rotalar, harita, hesaplama, pazarlar) |
| `data/istanbul.json` | **Tüm şehir bilgisi.** Güncellemeler burada yapılır. |
| `sw.js` | İnternetsiz çalışma (önbellek) |
| `manifest.webmanifest` | Telefona yükleme ayarları (ad, renk, ikon) |
| `icons/` | Uygulama ikonları. `node tools/make-icons.mjs` ile yeniden üretilir. |
| `maps/istanbul.pmtiles` | İstanbul haritası (50 MB). Kullanıcı "Haritayı indir" düğmesine basınca telefona kaydedilir. |
| `maps/fonts/`, `maps/sprites/` | Haritadaki yazıların yazı tipleri ve ikonlar. Uygulamayla birlikte internetsiz çalışır. |
| `tools/serve.mjs` | Bilgisayarda test için küçük sunucu |

Harita verisi: © OpenStreetMap katkıcıları (ODbL), Protomaps. Kaynak gösterimi zorunludur ve haritanın köşesinde yer alır.
