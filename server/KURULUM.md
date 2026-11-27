# Asistan sunucusunu kurmak (Cloudflare Workers)

Bu klasör, uygulamadaki **Asistan ve çevirmen** ekranının küçük sunucusudur. Telefon yapay zekâya doğrudan bağlanmaz; bu sunucuya sorar. Yapay zekâ anahtarı yalnızca Cloudflare'de şifreli durur, uygulamada ve bu klasörde **hiçbir zaman** yazmaz.

Bu klasör GitHub'a da gider ve herkese açıktır. Bu sorun değil: içinde gizli bilgi yok.

## Bir kez yapılacaklar

### 1. Anthropic hesabı ve anahtar (sen yaparsın)

1. https://console.anthropic.com adresinde hesap aç.
2. **Billing** bölümünden kartını kendin ekle ve az bir kredi yükle.
3. **Limits** bölümünden **aylık harcama sınırı** koy (örneğin 10 $). Sınır dolunca asistan durur, fazla para çekilmez.
4. **API Keys** bölümünden yeni anahtar oluştur. Anahtar yalnızca bir kez gösterilir. Şimdilik kopyala, kimseye gönderme, sohbete de yazma.

### 2. Cloudflare hesabı (sen yaparsın)

https://dash.cloudflare.com adresinde ücretsiz hesap aç.

### 3. Sunucuyu yükle (PowerShell'de, bu klasörün içinde)

```powershell
cd istanbul-rota-app\server
```

```powershell
npm install
```

```powershell
npx wrangler login
```

Tarayıcı açılır, Cloudflare hesabınla izin ver.

```powershell
npx wrangler deploy
```

En sonda `https://istanbul-rota-asistan.<senin-adın>.workers.dev` gibi bir adres yazar. **Bu adresi bana gönder.** Adres gizli değildir.

```powershell
npx wrangler secret put ANTHROPIC_API_KEY
```

"Enter a secret value" diye sorar. 1. adımda kopyaladığın anahtarı buraya yapıştır ve Enter'a bas. Ekranda görünmez, normaldir. Anahtar doğrudan Cloudflare'e gider.

Bu kadar. Adresi bana gönderdiğinde uygulamaya bağlarım, deneriz ve yayına almadan önce sana sorarım.

## Sonradan

- **Modeli değiştirmek:** `wrangler.toml` içinde `MODEL` (sohbet) ve `TRANSLATE_MODEL` (çeviri) satırları var. Örneğin çeviriyi ucuzlatmak için `claude-haiku-5-5` yaz, sonra `npx wrangler deploy` çalıştır.
- **Sınırlar:** her telefon dakikada en çok 5 soru ve 5 çeviri gönderebilir. Bütün uygulama için dakikada 60 istek sınırı var. Bu sayılar `wrangler.toml` içinde. Cloudflare bunları yaklaşık sayar. Asıl para güvencesi Anthropic'teki aylık harcama sınırıdır.
- **Maliyeti izlemek:** Anthropic Console → Usage. Ayrıca Cloudflare panelinde Workers → istanbul-rota-asistan → Logs bölümünde her sorunun kaç "token" harcadığı görünür. Kullanıcının yazdığı metin kaydedilmez.
- **Anahtarı yenilemek:** Anthropic'te yeni anahtar oluştur, `npx wrangler secret put ANTHROPIC_API_KEY` ile değiştir, eskisini Anthropic'te sil.
- **Test:** `npm test` gerçek yapay zekâyı çağırmadan sunucunun kurallarını dener. Para harcamaz.
