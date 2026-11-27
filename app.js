'use strict';
// İstanbul Rota: all city content lives in data/istanbul.json. This file only draws it.
// Layout: full-screen map + bottom sheet. Palettes and theme are user settings.

var TABS = ['rotalar', 'plan', 'anilar', 'ulasim', 'pazarlar', 'ayarlar'];
var DATA = null;
var lang = 'tr';
var routeId = null;
var currentTab = 'rotalar';
var map = null;
var myPos = null;
var installEvent = null;
var prefs = { palette: 'bogaz', theme: 'auto' };

try {
  var savedPrefs = JSON.parse(localStorage.getItem('rota-prefs') || '{}');
  if (savedPrefs.palette) prefs.palette = savedPrefs.palette;
  if (savedPrefs.theme) prefs.theme = savedPrefs.theme;
  var savedLang = localStorage.getItem('rota-lang');
  if (savedLang === 'tr' || savedLang === 'en') lang = savedLang;
} catch (e) {}

// ---------- Palettes (light and dark variant of each) ----------
var WARN_L = { 'warn-bg': '#FFF4E0', 'warn-ink': '#7A4A06' };
var WARN_D = { 'warn-bg': '#3A2A10', 'warn-ink': '#F5D29A' };
function pal(o, w) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k]; }); Object.keys(w).forEach(function (k) { r[k] = w[k]; }); return r; }
var PALETTES = {
  bogaz: { name: { tr: 'Boğaz', en: 'Bosphorus' },
    light: pal({ bg: '#F2F7F6', surface: '#FFFFFF', ink: '#0E2A2F', muted: '#557072', primary: '#0B5563', 'on-primary': '#FFFFFF', accent: '#E07A5F', line: '#D5E4E1', soft: '#E3F0ED' }, WARN_L),
    dark: pal({ bg: '#071B1F', surface: '#0F2A30', ink: '#E6F2F0', muted: '#8FAEAB', primary: '#5DCAA5', 'on-primary': '#04241F', accent: '#F0997B', line: '#1E3D43', soft: '#133238' }, WARN_D) },
  iznik: { name: { tr: 'İznik', en: 'Iznik' },
    light: pal({ bg: '#F3F6FB', surface: '#FFFFFF', ink: '#12233D', muted: '#5A6779', primary: '#1F48A8', 'on-primary': '#FFFFFF', accent: '#2A9D8F', line: '#DCE3EC', soft: '#E7EEF8' }, WARN_L),
    dark: pal({ bg: '#0C1424', surface: '#142036', ink: '#EAF0F8', muted: '#9DAABD', primary: '#6E95F0', 'on-primary': '#0C1424', accent: '#5DCAA5', line: '#24324C', soft: '#1B2A46' }, WARN_D) },
  lale: { name: { tr: 'Lale', en: 'Tulip' },
    light: pal({ bg: '#FFF8F3', surface: '#FFFFFF', ink: '#2B1215', muted: '#7A5C58', primary: '#B3132F', 'on-primary': '#FFFFFF', accent: '#B7791F', line: '#EEDBD0', soft: '#F8E8DE' }, WARN_L),
    dark: pal({ bg: '#1A0B0D', surface: '#2A1316', ink: '#F7E9E6', muted: '#C2A29D', primary: '#F07A8A', 'on-primary': '#2A0A0F', accent: '#E9B86A', line: '#43242A', soft: '#341A1E' }, WARN_D) },
  galata: { name: { tr: 'Gece Galata', en: 'Galata Night' },
    light: pal({ bg: '#F5F3EE', surface: '#FFFFFF', ink: '#16213A', muted: '#5D6578', primary: '#16213A', 'on-primary': '#FFFFFF', accent: '#C27C1E', line: '#E2DED4', soft: '#ECE8DE' }, WARN_L),
    dark: pal({ bg: '#0E1628', surface: '#16213A', ink: '#F2EEE6', muted: '#9AA3B5', primary: '#E9A54A', 'on-primary': '#1A1306', accent: '#6E95F0', line: '#26324C', soft: '#1B2A46' }, WARN_D) },
  simit: { name: { tr: 'Simit ve çay', en: 'Simit and tea' },
    light: pal({ bg: '#FBF5EC', surface: '#FFFDF8', ink: '#2E1D0E', muted: '#7C6450', primary: '#7A4A1E', 'on-primary': '#FFFFFF', accent: '#B23A2E', line: '#EADCC6', soft: '#F3E8D6' }, WARN_L),
    dark: pal({ bg: '#1A120A', surface: '#271B10', ink: '#F5EADB', muted: '#BFA88C', primary: '#E0A458', 'on-primary': '#241606', accent: '#E8857A', line: '#3D2C1C', soft: '#30231A' }, WARN_D) }
};
var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function isDark() { return prefs.theme === 'dark' || (prefs.theme === 'auto' && !!(mq && mq.matches)); }
function tokens() { var p = PALETTES[prefs.palette] || PALETTES.bogaz; return isDark() ? p.dark : p.light; }
function applyTheme() {
  var t = tokens(), root = document.documentElement;
  Object.keys(t).forEach(function (k) { root.style.setProperty('--' + k, t[k]); });
  root.style.colorScheme = isDark() ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark() ? t.surface : t.primary);
}
function savePrefs() { try { localStorage.setItem('rota-prefs', JSON.stringify(prefs)); } catch (e) {} }
applyTheme();

// ---------- Text ----------
var UI = {
  tabRotalar: { tr: 'Rotalar', en: 'Routes' },
  tabPlan: { tr: 'Planım', en: 'My plan' },
  tabAnilar: { tr: 'Anılarım', en: 'Memories' },
  tripH: { tr: 'Gezi modu', en: 'Trip mode' },
  tripIntro: { tr: 'Konumunu canlı takip eder, sıradaki durağa yolu gösterir, yürüdüğün mesafeyi ve adımlarını tahmin eder. Bir yere yaklaşınca ziyaretini işaretlemeni önerir. Konum sadece bu telefonda kullanılır; uygulama açıkken çalışır.', en: 'Follows your location live, shows the way to your next stop, and estimates distance and steps. When you reach a place it offers to mark it visited. Your location stays on this phone; it works while the app is open.' },
  tripStart: { tr: 'Gezi modunu başlat', en: 'Start trip mode' },
  tripStop: { tr: 'Geziyi bitir', en: 'End trip' },
  tripLive: { tr: 'Gezi sürüyor', en: 'Trip in progress' },
  tripWaiting: { tr: 'Konum bekleniyor…', en: 'Waiting for location…' },
  tripTime: { tr: 'süre', en: 'time' },
  tripKm: { tr: 'yürüyüş', en: 'walked' },
  tripSteps: { tr: 'adım (tahmini)', en: 'steps (est.)' },
  tripNext: { tr: 'Sıradaki durak', en: 'Next stop' },
  tripNextLine: { tr: '{d} · yürüyerek ~{m} dk', en: '{d} · ~{m} min on foot' },
  tripDone: { tr: 'Planındaki bütün durakları gezdin!', en: 'You visited every stop in your plan!' },
  follow: { tr: 'Haritada beni takip et', en: 'Keep the map on me' },
  following: { tr: 'Harita seni takip ediyor', en: 'The map follows you' },
  noGeo: { tr: 'Bu telefonda konum kullanılamıyor. Konum iznini aç.', en: 'Location is not available on this phone. Allow location access.' },
  nearbyQ: { tr: 'Buradasın: {name}', en: 'You are at: {name}' },
  nearbyVisit: { tr: 'Ziyaret ettim (+10)', en: 'I visited (+10)' },
  later: { tr: 'Sonra', en: 'Later' },
  metroBtn: { tr: 'Metrodayım / tramvaydayım', en: 'I am on the metro / tram' },
  metroLine: { tr: 'Hat', en: 'Line' },
  metroFrom: { tr: 'Bindiğin durak', en: 'Boarded at' },
  metroTo: { tr: 'İneceğin durak', en: 'Getting off at' },
  metroGo: { tr: 'Tahmini başlat', en: 'Start estimate' },
  metroCancel: { tr: 'Metrodan çıktım', en: 'I left the metro' },
  metroEst: { tr: 'Şu an muhtemelen: {st}', en: 'Probably now at: {st}' },
  metroLeft: { tr: '{n} durak kaldı · ~{m} dk', en: '{n} stops left · ~{m} min' },
  metroArrive: { tr: 'İneceğin durak geldi sayılır (tahmini): {st}', en: 'Your stop should be now (estimate): {st}' },
  metroNote: { tr: 'Yer altında GPS çalışmaz; tahmin durak başına ~2 dakikaya göre yapılır. Durak listeleri doğrulanacak.', en: 'GPS does not work underground; the estimate assumes ~2 minutes per stop. Station lists are to be verified.' },
  metroExit: { tr: 'Konum geri geldi, metro tahmini kapatıldı.', en: 'Location is back; metro estimate turned off.' },
  visitBtn: { tr: 'Ziyaret ettim (+10)', en: 'I visited (+10)' },
  visitedBtn: { tr: '✓ Ziyaret edildi (geri al)', en: '✓ Visited (undo)' },
  visitedOn: { tr: 'Ziyaret: {d}', en: 'Visited: {d}' },
  markVisit: { tr: 'Ziyaret ettim', en: 'Mark visited' },
  points: { tr: 'puan', en: 'points' },
  levelOf: { tr: 'Seviye {n}: {name}', en: 'Level {n}: {name}' },
  toNext: { tr: 'Sonraki seviyeye {p} puan', en: '{p} points to the next level' },
  maxLevel: { tr: 'En yüksek seviyedesin!', en: 'You reached the top level!' },
  badgesH: { tr: 'Rozetler', en: 'Badges' },
  routesH: { tr: 'Rotalar', en: 'Routes' },
  historyH: { tr: 'Gezdiğin yerler', en: 'Places you visited' },
  noVisits: { tr: 'Henüz bir yer işaretlemedin. Bir yeri gezince kartındaki "Ziyaret ettim" düğmesine bas; puan kazan, rozetleri aç. Gezdiğin yerler haritada yeşil görünür.', en: 'You haven\'t marked any place yet. After a visit, tap "I visited" on its card to earn points and badges. Visited places turn green on the map.' },
  undo: { tr: 'Geri al', en: 'Undo' },
  toastVisit: { tr: '+10 puan: {name}', en: '+10 points: {name}' },
  toastRoute: { tr: '+50 puan! "{name}" rotasını tamamladın', en: '+50 points! You finished "{name}"' },
  toastBadge: { tr: 'Yeni rozet: {name}', en: 'New badge: {name}' },
  memNote: { tr: 'Anıların sadece bu telefonda saklanır.', en: 'Your memories are stored only on this phone.' },
  sosTitle: { tr: 'Acil durumda 112', en: 'Emergency: 112' },
  sosText: { tr: 'Polis, ambulans, itfaiye: hepsi tek numara.', en: 'Police, ambulance, fire: one number for all.' },
  sosCall: { tr: 'Ara', en: 'Call' },
  call: { tr: 'Ara', en: 'Call' },
  open: { tr: 'Aç', en: 'Open' },
  source: { tr: 'Kaynak', en: 'Source' },
  tagOk: { tr: 'resmî kaynak', en: 'official source' },
  tagNo: { tr: 'doğrulanmadı', en: 'not confirmed' },
  tagTip: { tr: 'ipucu', en: 'tip' },
  phrasebook: { tr: 'Cep sözlüğü (Türkçe)', en: 'Pocket phrasebook (Turkish)' },
  phraseHint: { tr: 'Dinle düğmesi cümleyi Türkçe okur. Göster düğmesi büyük yazıyla ekrana getirir; karşındakine göster.', en: 'Listen reads the phrase aloud in Turkish. Show puts it on screen in big letters so you can show it to someone.' },
  listen: { tr: 'Dinle', en: 'Listen' },
  showBig: { tr: 'Göster', en: 'Show' },
  noVoice: { tr: 'Bu telefonda Türkçe ses yok; Göster düğmesini kullan.', en: 'No Turkish voice on this phone; use Show instead.' },
  railTitle: { tr: 'Metro, tramvay, Marmaray: hangi hat, hangi yön?', en: 'Metro, tram, Marmaray: which line, which direction?' },
  railIntro: { tr: 'Nereden nereye gideceğini yaz. Hangi hatta binip peronda hangi yazıyı arayacağını, kaç durak sonra ineceğini gösterelim.', en: 'Type where you start and where you are going. We show which line to take, which sign to look for on the platform and after how many stops to get off.' },
  railLoading: { tr: 'Metro bilgileri yükleniyor…', en: 'Loading rail information…' },
  railFrom: { tr: 'Nereden', en: 'From' },
  railTo: { tr: 'Nereye', en: 'To' },
  railPh: { tr: 'İstasyon veya gezilecek yer yaz…', en: 'Type a station or a place…' },
  railMe: { tr: 'Konumum', en: 'My location' },
  railUseMe: { tr: 'Konumum', en: 'My location' },
  railSwap: { tr: 'Nereden ve nereyeyi değiştir', en: 'Swap from and to' },
  railGo: { tr: 'Nasıl giderim?', en: 'How do I get there?' },
  railPlace: { tr: 'yer', en: 'place' },
  railNewAirport: { tr: 'İstanbul Havalimanı', en: 'Istanbul Airport' },
  railOldAirport: { tr: 'eski havalimanı, yolcu uçuşu yok', en: 'old airport, no passenger flights' },
  railPick: { tr: 'Listeden bir istasyon veya yer seç (yazmaya başlayınca liste açılır).', en: 'Pick a station or place from the list (it opens as you type).' },
  railSame: { tr: 'İkisi de aynı istasyona yakın; yürüyerek gidebilirsin.', en: 'Both are near the same station; you can walk.' },
  railNone: { tr: 'Raylı sistemle bağlantı bulunamadı. Otobüs, vapur veya taksi gerekebilir.', en: 'No rail connection found. You may need a bus, ferry or taxi.' },
  railNoPos: { tr: 'Konumun alınamadı. Konum iznini aç ya da bir istasyon yaz.', en: 'Could not get your location. Allow location or type a station.' },
  railLocating: { tr: 'Konumun bulunuyor…', en: 'Finding your location…' },
  railSummary: { tr: 'Yaklaşık {m} dk · {n} aktarma', en: 'About {m} min · {n} change(s)' },
  railWalkTo: { tr: '🚶 {from} → {to} istasyonuna yürü (yaklaşık {m} m, {min} dk)', en: '🚶 Walk from {from} to {to} station (about {m} m, {min} min)' },
  railWalkFrom: { tr: '🚶 {from} istasyonundan çık, {to} yerine yürü (yaklaşık {m} m, {min} dk)', en: '🚶 Leave {from} station and walk to {to} (about {m} m, {min} min)' },
  railFar: { tr: 'Uzak: taksi veya otobüs daha iyi olabilir.', en: 'Far: a taxi or bus may be better.' },
  railChange: { tr: '↔ Aktarma: {a} istasyonunda in, {line} hattına geç ({b}, yaklaşık {m} m yürüme). Tabelalarda {line} işaretini takip et.', en: '↔ Change: get off at {a} and walk to the {line} line ({b}, about {m} m). Follow the {line} signs.' },
  railSignLabel: { tr: 'Peronda bu yazıyı ara', en: 'Look for this sign on the platform' },
  railOr: { tr: 'veya', en: 'or' },
  railLoop: { tr: 'Bu hat tek yönde tur atar; her araç doğru yöne gider.', en: 'This line runs one way in a loop; every tram goes the right way.' },
  railRide: { tr: '{from} istasyonundan bin → {n} durak → {to} istasyonunda in.', en: 'Board at {from} → {n} stops → get off at {to}.' },
  railStops: { tr: 'Aradaki {n} durak', en: '{n} stops in between' },
  railHours: { tr: 'İlk sefer {f} · son sefer {l} (Metro İstanbul)', en: 'First train {f} · last train {l} (Metro İstanbul)' },
  railNotNow: { tr: 'Şu an bu hatta sefer olmayabilir (çalışma saatleri dışında).', en: 'There may be no service now (outside operating hours).' },
  railComputed: { tr: 'Bu hattın durak sırası istasyon konumlarından hesaplandı; resmî haritayla da kontrol et.', en: 'This line\'s stop order was worked out from station positions; check the official map too.' },
  railTip: { tr: 'İpucu: aracın önünde yazan son durak, ineceğin durağın ilerisinde olmalı. Bazı seferler hattın sonuna kadar gitmez. Süreler tahminidir.', en: 'Tip: the destination shown on the front of the train must be beyond your stop. Some trains end early. Times are estimates.' },
  railSource: { tr: 'Kaynak: Metro İstanbul ve İBB Açık Veri ({d}). Hat renkleri Metro İstanbul\'dan; Marmaray, M11, F2 ve Sirkeci–Kazlıçeşme renkleri resmî değil.', en: 'Source: Metro İstanbul and İBB Open Data ({d}). Line colors from Metro İstanbul; Marmaray, M11, F2 and Sirkeci–Kazlıçeşme colors are not official.' },
  phraseSearch: { tr: 'Sözlükte ara (Türkçe veya İngilizce)', en: 'Search the phrasebook (English or Turkish)' },
  phraseNone: { tr: 'Bu kelimeyle cümle yok. Başka bir kelime dene.', en: 'No phrase with that word. Try another word.' },
  phraseFound: { tr: '{n} cümle bulundu', en: '{n} phrases found' },
  // Assistant and translator (need internet and the app's own server)
  asstTitle: { tr: 'Asistan ve çevirmen', en: 'Assistant and translator' },
  asstNoBackendShort: { tr: 'Soru sor, çeviri yap. İnternet ve sunucu gerekir; henüz hazır değil.', en: 'Ask questions, translate. Needs internet and the server; not ready yet.' },
  asstReadyShort: { tr: 'Gezinle ilgili soru sor, istediğin dilden Türkçeye çevir.', en: 'Ask about your trip, translate any language to and from Turkish.' },
  asstChat: { tr: 'Sohbet', en: 'Chat' },
  asstTranslate: { tr: 'Çeviri', en: 'Translate' },
  asstNoBackend: { tr: 'Bu bölüm henüz hazır değil. Asistan ve çeviri için internet ve uygulamanın kendi sunucusu gerekir; sunucu henüz kurulmadı. Şimdilik cep sözlüğü internetsiz çalışır.', en: 'This part is not ready yet. The assistant and translator need internet and the app\'s own server, which is not set up yet. The pocket phrasebook works offline in the meantime.' },
  asstOffline: { tr: 'İnternet yok. Asistan ve çeviri internetle çalışır. Cep sözlüğü internetsiz çalışır.', en: 'No internet. The assistant and translator need internet. The pocket phrasebook works offline.' },
  asstToPhrasebook: { tr: 'Cep sözlüğünü aç', en: 'Open the phrasebook' },
  asstHello: { tr: 'Merhaba! İstanbul gezinle ilgili sorabilirsin: nereye gidilir, nasıl gidilir, ne kadar tutar, hangi gün kapalı. Uygulamadaki bilgilere göre cevap veririm; emin olmadığım şeyi söylerim.', en: 'Hello! Ask me about your Istanbul trip: where to go, how to get there, what it costs, which day a place is closed. I answer from the app\'s own information and say so when I am not sure.' },
  asstSug1: { tr: 'Bugün hangi müzeler açık?', en: 'Which museums are open today?' },
  asstSug2: { tr: 'Sultanahmet\'e en ucuz nasıl giderim?', en: 'What is the cheapest way to Sultanahmet?' },
  asstSug3: { tr: 'Planıma göre öğle yemeğini nerede yerim?', en: 'Where should I have lunch on my plan?' },
  asstPlaceholder: { tr: 'Sorunu yaz…', en: 'Type your question…' },
  asstSend: { tr: 'Gönder', en: 'Send' },
  asstSharePlan: { tr: 'Planımı paylaş', en: 'Share my plan' },
  asstShareLoc: { tr: 'Yaklaşık konumumu paylaş', en: 'Share my rough location' },
  asstShareNote: { tr: 'İşaretlemezsen planın ve konumun gönderilmez. Konum yaklaşık 100 metreye yuvarlanır.', en: 'Unless you tick these, your plan and location are not sent. Location is rounded to about 100 metres.' },
  asstPrivacy: { tr: 'Yazdıkların cevap için uygulamanın sunucusuna ve yapay zekâ hizmetine gönderilir. İsim, pasaport no gibi kişisel bilgi yazma. Yapay zekâ yanılabilir; fiyat ve saatleri resmî kaynaktan kontrol et.', en: 'What you type is sent to the app\'s server and an AI service to get an answer. Do not type personal details such as your name or passport number. AI can be wrong; check prices and hours with the official source.' },
  asstThinking: { tr: 'Cevap hazırlanıyor…', en: 'Working on an answer…' },
  asstWait: { tr: 'Biraz bekle, sonra tekrar gönder.', en: 'Please wait a moment, then send again.' },
  asstError: { tr: 'Cevap alınamadı. İnternetini kontrol edip tekrar dene.', en: 'Could not get an answer. Check your internet and try again.' },
  asstLimit: { tr: 'Çok sık gönderdin. Bir dakika bekleyip tekrar dene.', en: 'Too many in a row. Wait a minute and try again.' },
  asstBusy: { tr: 'Asistan şu an çok yoğun. Biraz sonra tekrar dene.', en: 'The assistant is very busy right now. Try again shortly.' },
  asstClear: { tr: 'Sohbeti temizle', en: 'Clear chat' },
  trToTr: { tr: 'Türkçeye çevir', en: 'Into Turkish' },
  trFromTr: { tr: 'Türkçeden çevir', en: 'From Turkish' },
  trLang: { tr: 'Dil', en: 'Language' },
  trAuto: { tr: 'Dili kendisi tanısın', en: 'Detect the language' },
  trInput: { tr: 'Çevrilecek metin', en: 'Text to translate' },
  trInputPh: { tr: 'Buraya yaz…', en: 'Type here…' },
  trGo: { tr: 'Çevir', en: 'Translate' },
  trResult: { tr: 'Çeviri', en: 'Translation' },
  trMatches: { tr: 'İnternetsiz: cep sözlüğünde benzer cümleler', en: 'Offline: similar phrases in the pocket phrasebook' },
  trNoMatch: { tr: 'Cep sözlüğünde benzer cümle yok.', en: 'No similar phrase in the pocket phrasebook.' },
  trEmpty: { tr: 'Önce çevrilecek metni yaz.', en: 'Type the text to translate first.' },
  trSay: { tr: 'Sesli oku', en: 'Read aloud' },
  modePackages: { tr: 'Hazır rotalar', en: 'Ready routes' },
  modeExplore: { tr: 'Yerleri keşfet', en: 'Explore places' },
  onlyFree: { tr: 'Sadece ücretsiz', en: 'Free only' },
  free: { tr: 'ücretsiz', en: 'free' },
  noResults: { tr: 'Bu filtrelere uyan yer yok.', en: 'No places match these filters.' },
  addToPlan: { tr: '+ Plana ekle', en: '+ Add to plan' },
  inPlanRemove: { tr: '✓ Planımda (çıkar)', en: '✓ In my plan (remove)' },
  routeToPlan: { tr: 'Bu rotayı planıma ekle', en: 'Add this route to my plan' },
  planStart: { tr: 'Ne zaman başlıyorsun?', en: 'When do you start?' },
  startNow: { tr: 'Şimdi', en: 'Now' },
  startTomorrow: { tr: 'Yarın 09:00', en: 'Tomorrow 09:00' },
  planEmptyH: { tr: 'Planın henüz boş', en: 'Your plan is empty' },
  planEmpty: { tr: 'Bir hazır rotayı planına ekle ya da "Yerleri keşfet"ten istediğin yerleri + ile seç. Saatleri, yürüme sürelerini ve ulaşımı ben hesaplarım.', en: 'Add a ready route, or pick places with + in "Explore places". The app works out times, walking and transport.' },
  planExplore: { tr: 'Yerleri keşfet', en: 'Explore places' },
  sumStops: { tr: 'durak', en: 'stops' },
  sumWalk: { tr: 'yürüyüş', en: 'walking' },
  legWalk: { tr: 'Yürüme {m} dk · {km} km', en: 'Walk {m} min · {km} km' },
  legRide: { tr: 'Toplu taşıma ya da taksi ~{m} dk · {km} km (taksi ≈ {taxi})', en: 'Transit or taxi ~{m} min · {km} km (taxi ≈ {taxi})' },
  leave: { tr: 'çıkış {t}', en: 'leave {t}' },
  stayMin: { tr: '~{m} dk', en: '~{m} min' },
  closedWarn: { tr: 'Bu yer {d} günleri kapalı. Başka bir güne al ya da plandan çıkar.', en: 'This place is closed on {d}. Move it to another day or remove it.' },
  moveUp: { tr: 'Yukarı taşı', en: 'Move up' },
  moveDown: { tr: 'Aşağı taşı', en: 'Move down' },
  remove: { tr: 'Plandan çıkar', en: 'Remove' },
  planMap: { tr: 'Haritada göster', en: 'Show on map' },
  planOptimize: { tr: 'En kısa sıraya diz', en: 'Shortest order' },
  planCalendar: { tr: 'Takvime ekle', en: 'Add to calendar' },
  planClear: { tr: 'Planı temizle', en: 'Clear plan' },
  planClearConfirm: { tr: 'Emin misin? Tekrar dokun', en: 'Sure? Tap again' },
  planNote: { tr: 'Süreler tahminidir: yürüyüş 4,5 km/sa, şehir içi araç ~18 km/sa. Kapalı günler ve saatler yer kartlarında yazar.', en: 'Times are estimates: walking 4.5 km/h, city traffic ~18 km/h. Closing days and hours are on each place card.' },
  tabUlasim: { tr: 'Ulaşım', en: 'Transport' },
  tabPazarlar: { tr: 'Pazarlar', en: 'Markets' },
  tabAyarlar: { tr: 'Ayarlar', en: 'Settings' },
  offline: { tr: 'İnternet yok', en: 'Offline' },
  allPlaces: { tr: 'Tüm yerler', en: 'All places' },
  allPlacesIntro: { tr: 'Haritadaki (!) işaretlerine dokun, o yerin bilgileri burada açılır. Bir rota seçersen haritaya çizilir.', en: 'Tap a (!) marker on the map to see that place here. Pick a route and it is drawn on the map.' },
  locating: { tr: 'Konum alınıyor…', en: 'Getting your location…' },
  locateFail: { tr: 'Konum alınamadı. Telefon ayarlarından konum iznini aç.', en: 'Could not get your location. Allow location access in your phone settings.' },
  back: { tr: '← Geri', en: '← Back' },
  directions: { tr: 'Yol tarifi', en: 'Directions' },
  fareHere: { tr: 'Buraya taksi ücreti', en: 'Taxi fare to here' },
  reportPlace: { tr: 'Bilgi yanlış mı?', en: 'Wrong info?' },
  inRoutes: { tr: 'Bu yer şu rotalarda:', en: 'Part of these routes:' },
  from: { tr: 'Nereden?', en: 'From?' },
  to: { tr: 'Nereye?', en: 'To?' },
  myLocation: { tr: 'Bulunduğum yer', en: 'My location' },
  km: { tr: 'Yol mesafesi (tahmini)', en: 'Road distance (estimate)' },
  wait: { tr: 'Trafikte bekleme', en: 'Waiting in traffic' },
  min: { tr: 'dk', en: 'min' },
  fuel: { tr: 'Benzin fiyatı (araba için)', en: 'Fuel price (for car)' },
  fuelNote: { tr: 'örnek değer, güncel fiyatı yaz', en: 'example value, enter today\'s price' },
  taxi: { tr: 'Taksi', en: 'Taxi' },
  taxiHow: { tr: 'Açılış {s} TL + km başı {k} TL + bekleme saati {w} TL, en az {m} TL', en: 'Start {s} TL + {k} TL per km + {w} TL per hour waiting, minimum {m} TL' },
  car: { tr: 'Kendi araban / kiralık', en: 'Own or rental car' },
  carHow: { tr: '100 km\'de {l} litre varsayımıyla yakıt. Otopark, köprü ve otoyol hariç.', en: 'Fuel only, assuming {l} L per 100 km. Parking, bridge and motorway tolls not included.' },
  transit: { tr: 'Metro, tramvay, otobüs, vapur', en: 'Metro, tram, bus, ferry' },
  transitHow: { tr: 'İstanbulkart tek biniş (tam). Öğrenci {st} TL. Kartın yoksa: tek kullanımlık bilet {single} TL ya da İstanbulkart {card} TL (kart bedeli). Karaköy/Eminönü–Kadıköy vapuru {ferry} TL. Aktarmada daha az ödenir. Kaynak: metro.istanbul, sehirhatlari.istanbul ({d}).', en: 'One full-fare ride with an Istanbulkart. Students {st} TL. Without a card: single-use ticket {single} TL, or an Istanbulkart for {card} TL (card price). Ferry Karaköy/Eminönü–Kadıköy {ferry} TL. Transfers cost less. Source: metro.istanbul, sehirhatlari.istanbul ({d}).' },
  transitAmt: { tr: 'eklenecek', en: 'coming' },
  perRide: { tr: '/ biniş', en: '/ ride' },
  fareSrc: { tr: 'Taksi tarifesi kaynağı: İBB UKOME ({d} tarihinde kontrol edildi). Mesafe kuş uçuşundan tahmin edilir; trafik ve güzergâha göre değişir.', en: 'Taxi fare source: IMM UKOME (checked {d}). Distance is estimated from the straight line and varies with traffic and route.' },
  district: { tr: 'İlçe', en: 'District' },
  allDistricts: { tr: 'Tüm ilçeler', en: 'All districts' },
  todayIs: { tr: 'Bugün {d}. Bugün kurulan pazarlar renkli.', en: 'Today is {d}. Markets open today are highlighted.' },
  today: { tr: 'Bugün', en: 'Today' },
  unknownDay: { tr: 'Gün?', en: 'Day?' },
  noMarkets: { tr: 'Bu ilçe için henüz pazar bilgisi yok.', en: 'No market info for this district yet.' },
  toVerify: { tr: 'doğrulanacak', en: 'to be verified' },
  approx: { tr: 'Konum yaklaşık', en: 'Approximate location' },
  look: { tr: 'Görünüm', en: 'Appearance' },
  palette: { tr: 'Renk paleti', en: 'Colour palette' },
  theme: { tr: 'Tema', en: 'Theme' },
  themeAuto: { tr: 'Otomatik', en: 'Automatic' },
  themeLight: { tr: 'Açık', en: 'Light' },
  themeDark: { tr: 'Koyu', en: 'Dark' },
  offlineMap: { tr: 'İnternetsiz harita', en: 'Offline map' },
  mapDownload: { tr: 'Haritayı indir ({s} MB)', en: 'Download map ({s} MB)' },
  mapDownloading: { tr: 'İndiriliyor: {p}', en: 'Downloading: {p}' },
  mapWasBroken: { tr: 'Telefondaki harita eksik inmişti, silindi. Aşağıdan tekrar indirebilirsin.', en: 'The saved map was incomplete and has been removed. You can download it again below.' },
  mapDownloadFail: { tr:'İndirme yarıda kaldı. İnternetini kontrol edip tekrar dene.', en: 'The download stopped. Check your connection and try again.' },
  mapSaved: { tr: 'İstanbul haritası telefonda kayıtlı. İnternetsiz çalışır.', en: 'The Istanbul map is saved on this phone. It works offline.' },
  mapOnline: { tr: 'Harita şu an internetten geliyor. İnternetsiz kullanmak için bir kez indir (Wi-Fi önerilir).', en: 'The map is loading over the internet. Download it once to use it offline (Wi-Fi recommended).' },
  mapNeedDownload: { tr: 'İnternet yok ve harita indirilmemiş. İnternete bağlanınca haritayı indir.', en: 'No internet and the map is not downloaded. Download it when you are back online.' },
  mapRemove: { tr: 'Haritayı sil', en: 'Delete map' },
  package: { tr: 'İstanbul paketi', en: 'Istanbul pass' },
  packageName: { tr: '7 günlük paket', en: '7-day pass' },
  packageNote: { tr: 'Ödeme yakında açılacak. Deneme sürümünde tüm özellikler şimdilik ücretsiz.', en: 'Payment opens soon. During the beta all features are free for now.' },
  installH: { tr: 'Telefona yükle', en: 'Install on your phone' },
  install: { tr: 'Telefona yükle', en: 'Install app' },
  installIos: { tr: 'iPhone\'da: Safari\'de Paylaş düğmesine, sonra "Ana Ekrana Ekle"ye dokun.', en: 'On iPhone: tap Share in Safari, then "Add to Home Screen".' },
  installOther: { tr: 'Tarayıcı menüsünden "Ana ekrana ekle" ya da "Uygulamayı yükle"yi seç.', en: 'Choose "Add to Home screen" or "Install app" from the browser menu.' },
  installed: { tr: 'Uygulama telefonda yüklü.', en: 'The app is installed.' },
  reportH: { tr: 'Eksik ya da yanlış bilgi bildir', en: 'Report missing or wrong info' },
  reportLabel: { tr: 'Ne eksik ya da yanlış? (örnek: "Kirazlı pazarı perşembe kuruluyor")', en: 'What is missing or wrong? (e.g. "This market is on Thursdays")' },
  reportSend: { tr: 'Kaydet', en: 'Save' },
  reportCopy: { tr: 'Kopyala', en: 'Copy' },
  reportSaved: { tr: 'Kaydedildi. Bu telefonda bekleyen bildirim: {n}. Sunucu bağlanınca otomatik gönderilecek.', en: 'Saved. Reports waiting on this phone: {n}. They will be sent once the server is connected.' },
  reportCopied: { tr: 'Kopyalandı. WhatsApp veya e-postayla gönderebilirsin.', en: 'Copied. You can send it by WhatsApp or email.' },
  reportEmpty: { tr: 'Önce ne eksik olduğunu yaz.', en: 'Write what is missing first.' },
  about: { tr: 'Bilgiler {d} tarihinde kontrol edildi. Harita verisi: © OpenStreetMap katkıcıları, Protomaps.', en: 'Info checked on {d}. Map data: © OpenStreetMap contributors, Protomaps.' },
  loadError: { tr: 'Şehir bilgileri yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.', en: 'Could not load the city info. Check your connection and reload.' }
};
var DAYS = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

function $(id) { return document.getElementById(id); }
function tx(o) { return o ? (o[lang] !== undefined ? o[lang] : o.tr) : ''; }
function t(k, vars) {
  var s = UI[k][lang];
  if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
  return s;
}
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function num(n, d) { return Number(n).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function money(n) { return num(Math.round(n)) + ' TL'; }
function fmtDate(iso) { var p = iso.split('-'); return lang === 'tr' ? p[2] + '.' + p[1] + '.' + p[0] : iso; }
function place(id) { return DATA.places.filter(function (p) { return p.id === id; })[0]; }
function market(id) { return DATA.markets.filter(function (m) { return m.id === id; })[0]; }
function haversineKm(a, b) {
  var R = 6371, r = function (x) { return x * Math.PI / 180; };
  var dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function factsHtml(p) {
  var out = (p.fees || []).map(function (f) { return '<span class="fact' + (f.verified ? '' : ' check') + '">' + esc(tx(f)) + '</span>'; });
  if (p.approx) out.push('<span class="fact check">' + esc(t('approx')) + '</span>');
  return '<div class="facts">' + out.join('') + '</div>';
}

// ---------- Bottom sheet ----------
function setSheet(size) { $('sheet').dataset.size = size; }
function sheetPx() { return $('sheet').getBoundingClientRect().height; }
function mapPadding() { return { top: 80, bottom: Math.round(sheetPx()) + 16, left: 30, right: 30 }; }
function cycleSheet() {
  var s = $('sheet').dataset.size;
  setSheet(s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek');
}

function showView(id) {
  ['rotalar', 'plan', 'anilar', 'ulasim', 'pazarlar', 'yer', 'yardim', 'asistan', 'ayarlar'].forEach(function (k) { $('view-' + k).hidden = k !== id; });
  TABS.forEach(function (k) {
    var a = $('tab-' + k);
    if (k === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('sheet-body').scrollTop = 0;
}
function show() {
  var v = (location.hash || '#rotalar').slice(1);
  var full = v === 'yardim' || v === 'asistan';   // full-height screens opened from the top bar
  if (TABS.indexOf(v) < 0 && !full) v = 'rotalar';
  currentTab = v;
  showView(v);
  if (full) { setSheet('full'); return; }
  if ($('sheet').dataset.size === 'peek') setSheet('half');
  // The map shows what the open tab is about: your plan, or the chosen ready route.
  if (v === 'plan') drawPlan();
  else if (v === 'rotalar') {
    var r = routeId ? DATA.routes.filter(function (x) { return x.id === routeId; })[0] : null;
    if (r) drawRoute(r); else clearRoute();
  }
}

// ---------- Routes ----------
function renderRoutes() {
  var chips = $('route-chips');
  chips.innerHTML = '';
  var all = document.createElement('button');
  all.type = 'button'; all.className = 'chip'; all.textContent = t('allPlaces');
  all.setAttribute('aria-pressed', routeId === null ? 'true' : 'false');
  all.addEventListener('click', function () { routeId = null; renderRoutes(); clearRoute(); fitAll(); });
  chips.appendChild(all);
  DATA.routes.forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = tx(r.name);
    b.setAttribute('aria-pressed', r.id === routeId ? 'true' : 'false');
    b.addEventListener('click', function () { routeId = r.id; renderRoutes(); drawRoute(r); });
    chips.appendChild(b);
  });
  if (routeId === null) {
    $('route').innerHTML = '<p class="where">' + esc(t('allPlacesIntro')) + '</p>';
    return;
  }
  var r = DATA.routes.filter(function (x) { return x.id === routeId; })[0];
  var html = '<div class="head"><h2>' + esc(tx(r.name)) + '</h2><p>' + esc(tx(r.intro)) + '</p></div><div class="meta">' +
    tx(r.meta).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' +
    '<div class="row" style="margin-bottom:14px"><button type="button" class="btn" id="route-to-plan">' + esc(t('routeToPlan')) + '</button></div><ol class="stops">';
  var n = 0;
  r.stops.forEach(function (s) {
    if (s.leg) { html += '<li class="leg">' + esc(tx(s.leg)) + '</li>'; return; }
    var p = place(s.place);
    n++;
    html += '<li class="stop"><span class="dot">' + n + '</span><button type="button" class="card" data-place="' + esc(p.id) + '"><span class="when mono">' + esc(s.time) + ' · ' + esc(p.district) +
      '</span><h3>' + esc(tx(p.name)) + '</h3><p>' + esc(tx(p.note)) + '</p>' + factsHtml(p) + '</button></li>';
  });
  html += '</ol>';
  $('route').innerHTML = html;
  $('route-to-plan').addEventListener('click', function () { addRouteToPlan(r); });
  Array.prototype.forEach.call($('route').querySelectorAll('[data-place]'), function (el) {
    el.addEventListener('click', function () { openPlace(el.getAttribute('data-place')); });
  });
}

// ---------- Place card ----------
function openPlace(id) {
  var p = place(id);
  if (!p) return;
  var cat = DATA.categories[p.cat];
  var inRoutes = DATA.routes.filter(function (r) { return r.stops.some(function (s) { return s.place === id; }); });
  var html = '<button type="button" class="back" id="place-back">' + esc(t('back')) + '</button>' +
    '<span class="cat" style="background:' + cat.color + '">' + esc(tx(cat)) + ' · ' + esc(p.district) + '</span>' +
    '<div class="head"><h2>' + esc(tx(p.name)) + '</h2><p>' + esc(tx(p.note)) + '</p></div>' + factsHtml(p) +
    (isVisited(id) ? '<p class="where" style="margin-top:8px">' + esc(t('visitedOn', { d: new Date(visits[id].date).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long' }) })) + '</p>' : '') +
    '<div class="actions"><button type="button" class="btn" id="plan-toggle">' + esc(inPlan(id) ? t('inPlanRemove') : t('addToPlan')) + '</button>' +
    '<button type="button" class="btn ghost" id="visit-toggle">' + esc(isVisited(id) ? t('visitedBtn') : t('visitBtn')) + '</button>' +
    '<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '">' + esc(t('directions')) + '</a>' +
    '<button type="button" class="btn ghost" id="fare-here">' + esc(t('fareHere')) + '</button>' +
    '<button type="button" class="btn ghost" id="report-place">' + esc(t('reportPlace')) + '</button></div>';
  if (inRoutes.length) {
    html += '<p class="label" style="margin-top:16px">' + esc(t('inRoutes')) + '</p><div class="chips" style="margin-top:8px">' +
      inRoutes.map(function (r) { return '<button type="button" class="chip" data-route="' + esc(r.id) + '">' + esc(tx(r.name)) + '</button>'; }).join('') + '</div>';
  }
  $('view-yer').innerHTML = html;
  showView('yer');
  if ($('sheet').dataset.size === 'peek') setSheet('half');
  $('place-back').addEventListener('click', function () { showView(currentTab); });
  $('plan-toggle').addEventListener('click', function () {
    togglePlan(id);
    $('plan-toggle').textContent = inPlan(id) ? t('inPlanRemove') : t('addToPlan');
  });
  $('visit-toggle').addEventListener('click', function () {
    toggleVisit(id);
    $('visit-toggle').textContent = isVisited(id) ? t('visitedBtn') : t('visitBtn');
  });
  $('fare-here').addEventListener('click', function () { $('to').value = id; setDistanceFromSelection(); location.hash = '#ulasim'; show(); });
  $('report-place').addEventListener('click', function () {
    location.hash = '#ayarlar'; show();
    $('report-text').value = tx(p.name) + ': ';
    $('report-section').scrollIntoView({ behavior: 'smooth' });
    $('report-text').focus();
  });
  Array.prototype.forEach.call($('view-yer').querySelectorAll('[data-route]'), function (el) {
    el.addEventListener('click', function () {
      routeId = el.getAttribute('data-route');
      location.hash = '#rotalar'; show(); renderRoutes();
      drawRoute(DATA.routes.filter(function (r) { return r.id === routeId; })[0]);
    });
  });
  if (map) setTimeout(function () { map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), padding: mapPadding() }); }, 260);
}

function openMarketOnMap(id) {
  var m = market(id);
  if (!m || m.lat === undefined || !map) return;
  map.easeTo({ center: [m.lng, m.lat], zoom: 15, padding: mapPadding() });
}

// ---------- Map: offline vector map from maps/istanbul.pmtiles ----------
var MAP_URL = 'maps/istanbul.pmtiles';
var MAP_CACHE = 'rota-map-v1';   // kept separately from the app cache so app updates never delete it
var MAP_MB = 50;
var mapFile = null;
var pmProtocol = null;
var overlaysReady = false;
var pendingRoute = null;

function absUrl(p) { return new URL(p, location.href).href; }
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

// A map file cut off mid-download still opens, but shows only the first part of the city (the rest stays
// blank). The PMTiles header says where the last byte should be, so a short file can be caught.
function mapComplete(blob) {
  if (!blob || blob.size < 127) return Promise.resolve(false);
  return blob.slice(0, 127).arrayBuffer().then(function (buf) {
    var dv = new DataView(buf), b = new Uint8Array(buf);
    if (String.fromCharCode.apply(null, b.subarray(0, 7)) !== 'PMTiles') return false;
    var u64 = function (o) { return dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296; };
    var end = Math.max(u64(8) + u64(16), u64(24) + u64(32), u64(40) + u64(48), u64(56) + u64(64));
    return blob.size >= end;
  }, function () { return false; });
}
var mapWasBroken = false;
function loadSavedMap() {
  if (!('caches' in window)) return Promise.resolve(null);
  return caches.open(MAP_CACHE)
    .then(function (c) {
      return c.match(absUrl(MAP_URL))
        .then(function (res) { return res ? res.blob() : null; })
        .then(function (b) {
          if (!b) return null;
          return mapComplete(b).then(function (ok) {
            if (ok) return b;
            mapWasBroken = true;               // throw the broken copy away; the map then loads online
            return c.delete(absUrl(MAP_URL)).then(function () { return null; });
          });
        });
    })
    .then(function (b) { mapFile = b; renderMapStatus(); return b; })
    .catch(function () { renderMapStatus(); return null; });
}

function mapStyle() {
  var url;
  if (mapFile) {
    pmProtocol.add(new pmtiles.PMTiles(new pmtiles.FileSource(new File([mapFile], 'istanbul.pmtiles'))));
    url = 'pmtiles://istanbul.pmtiles';
  } else {
    url = 'pmtiles://' + absUrl(MAP_URL);
  }
  return {
    version: 8,
    glyphs: absUrl('maps/fonts/') + '{fontstack}/{range}.pbf',
    sprite: absUrl('maps/sprites/light'),
    sources: { protomaps: { type: 'vector', url: url, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>' } },
    layers: basemaps.layers('protomaps', basemaps.namedFlavor(isDark() ? 'dark' : 'light'), { lang: lang })
  };
}

function ensureMap() {
  if (map || typeof window.maplibregl === 'undefined' || typeof window.pmtiles === 'undefined' || typeof window.basemaps === 'undefined') return;
  if (!pmProtocol) { pmProtocol = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', pmProtocol.tile); }
  overlaysReady = false;
  map = new maplibregl.Map({
    container: 'map', style: mapStyle(), center: [28.979, 41.012], zoom: 12.5,
    minZoom: 9, maxZoom: 18, maxBounds: [[28.45, 40.78], [29.45, 41.32]], attributionControl: false
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('error', function (e) { console.warn('map error:', e && e.error ? (e.error.message || e.error) : e); });
  map.on('dragstart', function () { if (trip.on && trip.follow) { trip.follow = false; renderTrip(); } });
  map.on('load', function () {
    addOverlays();
    if (pendingRoute) { var r = pendingRoute; pendingRoute = null; drawRoute(r); }
    else if (!firstFitDone) { firstFitDone = true; fitAll(); }
  });
}
var firstFitDone = false;

function resetMap() {
  if (map) {
    var view = { center: map.getCenter(), zoom: map.getZoom() };
    map.remove(); map = null; overlaysReady = false;
    ensureMap();
    if (map) map.jumpTo(view);
    if (drawnStops.length) pendingRoute = { stops: drawnStops.map(function (id) { return { place: id }; }) };
  } else {
    ensureMap();
  }
}

function placesGeoJSON() {
  var feats = DATA.places.map(function (p) {
    return { type: 'Feature', properties: { id: p.id, kind: 'place', color: DATA.categories[p.cat].color, visited: isVisited(p.id) }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } };
  });
  DATA.markets.forEach(function (m) {
    if (m.lat === undefined) return;
    feats.push({ type: 'Feature', properties: { id: m.id, kind: 'market', color: '#C77D1E' }, geometry: { type: 'Point', coordinates: [m.lng, m.lat] } });
  });
  return { type: 'FeatureCollection', features: feats };
}

function addOverlays() {
  var tk = tokens();
  map.addSource('route', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': tk.primary, 'line-width': 4, 'line-dasharray': [0.6, 1.8] } });
  map.addSource('places', { type: 'geojson', data: placesGeoJSON() });
  // Each place is a coloured circle with a white "!" in it: tap it for the info card.
  map.addLayer({ id: 'places', type: 'circle', source: 'places', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 11],
    'circle-color': ['case', ['==', ['get', 'kind'], 'market'], '#FFFFFF', ['==', ['get', 'visited'], true], '#2E8B3A', ['get', 'color']],
    'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'market'], '#C77D1E', '#FFFFFF'],
    'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'market'], 3, 2] } });
  map.addLayer({ id: 'places-mark', type: 'symbol', source: 'places', layout: {
    // Visited places turn green and lose the "!" (they show a small dot instead).
    'text-field': ['case', ['==', ['get', 'visited'], true], '•', '!'], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 14],
    'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': ['case', ['==', ['get', 'kind'], 'market'], '#C77D1E', '#FFFFFF'] } });
  map.addLayer({ id: 'route-stops', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 12, 'circle-color': tk.primary, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'route-num', type: 'symbol', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': tk['on-primary'] } });
  map.addSource('me', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#E5484D', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  ['places', 'places-mark', 'route-stops'].forEach(function (layer) {
    map.on('click', layer, function (e) {
      var f = e.features[0];
      if (layer === 'route-stops') {
        var stopId = drawnStops[f.properties.n - 1];
        if (stopId) openPlace(stopId);
        return;
      }
      if (f.properties.kind === 'market') { location.hash = '#pazarlar'; show(); return; }
      openPlace(f.properties.id);
    });
    map.on('mouseenter', layer, function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, function () { map.getCanvas().style.cursor = ''; });
  });
  overlaysReady = true;
  if (myPos) setMe();
  addRailLayers();
}

function clearRoute() { drawnStops = []; pendingRoute = null; if (map && overlaysReady) map.getSource('route').setData(emptyFC()); }
function fitAll() {
  if (!map) return;
  var b = new maplibregl.LngLatBounds([DATA.places[0].lng, DATA.places[0].lat], [DATA.places[0].lng, DATA.places[0].lat]);
  DATA.places.forEach(function (p) { if (p.district !== 'Sarıyer' && p.district !== 'Adalar') b.extend([p.lng, p.lat]); });
  map.fitBounds(b, { padding: mapPadding(), maxZoom: 14 });
}
var drawnStops = [];   // place ids of the numbered stops now on the map
function drawRoute(r) {
  // The map is created once at start-up (so it can use the saved offline copy); until then, remember the request.
  if (!map || !overlaysReady) { pendingRoute = r; return; }
  drawnStops = r.stops.filter(function (s) { return s.place && place(s.place); }).map(function (s) { return s.place; });
  if (!drawnStops.length) { clearRoute(); return; }
  var pts = drawnStops.map(function (id) { var p = place(id); return [p.lng, p.lat]; });
  var feats = pts.map(function (c, i) { return { type: 'Feature', properties: { n: i + 1 }, geometry: { type: 'Point', coordinates: c } }; });
  if (pts.length > 1) feats.unshift({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
  map.getSource('route').setData({ type: 'FeatureCollection', features: feats });
  var b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach(function (c) { b.extend(c); });
  map.fitBounds(b, { padding: mapPadding(), maxZoom: 16 });
}
function setMe() {
  if (!map || !overlaysReady || !myPos) return;
  map.getSource('me').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [myPos.lng, myPos.lat] } }] });
}
function locate() {
  if (!navigator.geolocation) { alertSheet(t('locateFail')); return; }
  navigator.geolocation.getCurrentPosition(function (pos) {
    myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (map) { setMe(); map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15, padding: mapPadding() }); }
    renderTransportOptions();
  }, function () { alertSheet(t('locateFail')); }, { enableHighAccuracy: true, timeout: 10000 });
}
function alertSheet(msg) {
  $('view-yer').innerHTML = '<button type="button" class="back" id="place-back">' + esc(t('back')) + '</button><p class="error">' + esc(msg) + '</p>';
  showView('yer');
  $('place-back').addEventListener('click', function () { showView(currentTab); });
}

// ---------- Offline map download ----------
function renderMapStatus() {
  var saved = !!mapFile;
  $('map-download').hidden = saved;
  $('map-download').disabled = false;
  $('map-download').textContent = t('mapDownload', { s: MAP_MB });
  $('map-remove').hidden = !saved;
  $('map-remove').textContent = t('mapRemove');
  $('map-status').className = 'status' + (saved ? ' saved' : '');
  $('map-status').textContent = saved ? t('mapSaved') : (mapWasBroken ? t('mapWasBroken') + ' ' : '') + (navigator.onLine ? t('mapOnline') : t('mapNeedDownload'));
}
function downloadMap() {
  $('map-download').disabled = true;
  fetch(MAP_URL, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      var total = Number(res.headers.get('content-length')) || 0, got = 0, chunks = [];
      var reader = res.body.getReader();
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var blob = new Blob(chunks, { type: 'application/octet-stream' });
            if (total && got < total) throw new Error('short');   // never save a cut-off file
            return mapComplete(blob).then(function (ok) { if (!ok) throw new Error('short'); return blob; });
          }
          chunks.push(r.value); got += r.value.length;
          $('map-status').textContent = t('mapDownloading', { p: total ? Math.round(got / total * 100) + '%' : Math.round(got / 1e6) + ' MB' });
          return pump();
        });
      }
      return pump();
    })
    .then(function (blob) {
      return caches.open(MAP_CACHE)
        .then(function (c) { return c.put(absUrl(MAP_URL), new Response(blob, { headers: { 'Content-Type': 'application/octet-stream' } })); })
        .then(function () { return blob; });
    })
    .then(function (blob) {
      mapFile = blob;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      renderMapStatus(); resetMap();
    })
    .catch(function () { $('map-status').textContent = t('mapDownloadFail'); $('map-download').disabled = false; });
}
function removeMap() {
  caches.open(MAP_CACHE).then(function (c) { return c.delete(absUrl(MAP_URL)); }).then(function () { mapFile = null; renderMapStatus(); resetMap(); });
}

// ---------- Explore: filter places and pick them for the plan ----------
var exploreMode = 'paket';
var filt = { cats: [], free: false, district: 'all' };
function isFree(p) { return (p.fees || []).length > 0 && p.fees.every(function (f) { return /^Ücretsiz/.test(f.tr); }); }
function renderExplore() {
  Array.prototype.forEach.call($('explore-seg').querySelectorAll('button'), function (b) {
    var m = b.getAttribute('data-mode');
    b.textContent = m === 'paket' ? t('modePackages') : t('modeExplore');
    b.setAttribute('aria-pressed', exploreMode === m ? 'true' : 'false');
  });
  $('mode-paket').hidden = exploreMode !== 'paket';
  $('mode-kesfet').hidden = exploreMode !== 'kesfet';
  $('cat-chips').innerHTML = Object.keys(DATA.categories).map(function (k) {
    return '<button type="button" class="chip small" data-cat="' + k + '" aria-pressed="' + (filt.cats.indexOf(k) >= 0 ? 'true' : 'false') + '">' + esc(tx(DATA.categories[k])) + '</button>';
  }).join('');
  $('free-chip').textContent = t('onlyFree');
  $('free-chip').setAttribute('aria-pressed', filt.free ? 'true' : 'false');
  var districts = DATA.places.map(function (p) { return p.district; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  $('explore-district').innerHTML = '<option value="all">' + esc(t('allDistricts')) + '</option>' + districts.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
  $('explore-district').value = filt.district;
  var list = DATA.places.filter(function (p) {
    return (!filt.cats.length || filt.cats.indexOf(p.cat) >= 0) && (!filt.free || isFree(p)) && (filt.district === 'all' || p.district === filt.district);
  }).sort(function (a, b) { return tx(a.name).localeCompare(tx(b.name), lang); });
  $('explore-list').innerHTML = list.length ? list.map(function (p) {
    var on = inPlan(p.id);
    return '<div class="pitem"><button type="button" class="open" data-open="' + esc(p.id) + '"><h3>' + esc(tx(p.name)) + (isFree(p) ? '<span class="badge">' + esc(t('free')) + '</span>' : '') + '</h3><span class="where">' +
      esc(tx(DATA.categories[p.cat])) + ' · ' + esc(p.district) + '</span></button><button type="button" class="add" data-add="' + esc(p.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(on ? t('inPlanRemove') : t('addToPlan')) + '">' + (on ? '✓' : '+') + '</button></div>';
  }).join('') : '<p class="where">' + esc(t('noResults')) + '</p>';
}

// ---------- Planner ----------
var VISIT_MIN = { muze: 90, cami: 30, tarihi: 60, carsi: 60, doga: 90, tiyatro: 120, semt: 45, iskele: 15 };
var plan = { stops: [], start: 'tomorrow' };
try {
  var savedPlan = JSON.parse(localStorage.getItem('rota-plan') || 'null');
  if (savedPlan && Array.isArray(savedPlan.stops)) plan = { stops: savedPlan.stops, start: savedPlan.start || 'tomorrow' };
} catch (e) {}
function savePlan() { try { localStorage.setItem('rota-plan', JSON.stringify(plan)); } catch (e) {} }
function inPlan(id) { return plan.stops.indexOf(id) >= 0; }
function planChanged() { savePlan(); renderPlan(); renderExplore(); if (currentTab === 'plan' && $('view-plan').hidden === false) drawPlan(); }
function togglePlan(id) {
  var i = plan.stops.indexOf(id);
  if (i >= 0) plan.stops.splice(i, 1); else plan.stops.push(id);
  planChanged();
}
function addRouteToPlan(r) {
  r.stops.forEach(function (s) { if (s.place && !inPlan(s.place)) plan.stops.push(s.place); });
  savePlan(); renderPlan(); renderExplore();
  location.hash = '#plan';
}
function visitMin(p) { return p.visitMin || VISIT_MIN[p.cat] || 60; }
function planStartDate() {
  var d = new Date();
  if (plan.start === 'now') { d.setSeconds(0, 0); return d; }
  if (!plan.start || plan.start === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }
  var c = new Date(plan.start);
  return isNaN(c.getTime()) ? d : c;
}
function legInfo(a, b) {
  var km = haversineKm(a, b) * DATA.fares.roadFactor;
  if (km <= 2) return { km: km, min: Math.max(3, Math.round(km / 4.5 * 60)), walk: true };
  var f = DATA.fares.taxi;
  return { km: km, min: Math.round(km / 18 * 60 + 8), walk: false, taxi: Math.max(f.min, f.start + km * f.perKm) };
}
function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function fmtDay(d) { return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
function schedule() {
  var start = planStartDate(), cur = new Date(start), items = [], walkKm = 0;
  plan.stops.forEach(function (id, i) {
    var p = place(id), leg = null;
    if (i > 0) {
      leg = legInfo(place(plan.stops[i - 1]), p);
      cur = new Date(cur.getTime() + leg.min * 60000);
      if (leg.walk) walkKm += leg.km;
    }
    var arrive = new Date(cur), leave = new Date(cur.getTime() + visitMin(p) * 60000);
    items.push({ p: p, leg: leg, arrive: arrive, leave: leave, closed: (p.closedDays || []).indexOf(arrive.getDay()) >= 0 });
    cur = leave;
  });
  return { items: items, start: start, end: cur, walkKm: walkKm };
}
function renderPlan() {
  $('t-plan-start').textContent = t('planStart');
  Array.prototype.forEach.call(document.querySelectorAll('[data-start]'), function (b) {
    var k = b.getAttribute('data-start');
    b.textContent = k === 'now' ? t('startNow') : t('startTomorrow');
    b.setAttribute('aria-pressed', plan.start === k ? 'true' : 'false');
  });
  var custom = plan.start && plan.start !== 'now' && plan.start !== 'tomorrow';
  $('plan-custom').value = custom ? plan.start : '';
  plan.stops = plan.stops.filter(function (id) { return !!place(id); });
  if (!plan.stops.length) {
    $('plan-body').innerHTML = '<div class="panel"><p class="label">' + esc(t('planEmptyH')) + '</p><p class="where">' + esc(t('planEmpty')) + '</p>' +
      '<div class="row"><button type="button" class="btn" data-goexplore="1">' + esc(t('planExplore')) + '</button></div></div>';
    return;
  }
  var s = schedule();
  var html = '<div class="summary"><div><b>' + s.items.length + '</b><span>' + esc(t('sumStops')) + '</span></div>' +
    '<div><b>' + hhmm(s.start) + '–' + hhmm(s.end) + '</b><span>' + esc(fmtDay(s.start)) + '</span></div>' +
    '<div><b>' + num(s.walkKm, 1) + ' km</b><span>' + esc(t('sumWalk')) + '</span></div></div>';
  s.items.forEach(function (it, i) {
    if (it.leg) html += '<p class="pleg">' + esc(it.leg.walk ? t('legWalk', { m: it.leg.min, km: num(it.leg.km, 1) }) : t('legRide', { m: it.leg.min, km: num(it.leg.km, 1), taxi: money(it.leg.taxi) })) + '</p>';
    html += '<div class="pstop"><div class="time">' + hhmm(it.arrive) + '<small>' + esc(t('leave', { t: hhmm(it.leave) })) + '</small></div>' +
      '<button type="button" class="open" data-open="' + esc(it.p.id) + '" style="border:0;background:transparent;text-align:left;padding:0;cursor:pointer;min-width:0;color:inherit">' +
      '<h3>' + esc(tx(it.p.name)) + '</h3><span class="where">' + esc(tx(DATA.categories[it.p.cat])) + ' · ' + esc(it.p.district) + ' · ' + esc(t('stayMin', { m: visitMin(it.p) })) + '</span>' +
      (it.closed ? '<p class="warn">' + esc(t('closedWarn', { d: DAYS[lang][it.arrive.getDay()] })) + '</p>' : '') + '</button>' +
      '<div class="tools"><button type="button" class="tool' + (isVisited(it.p.id) ? ' done' : '') + '" data-visit="' + esc(it.p.id) + '" aria-label="' + esc(t('markVisit')) + '" aria-pressed="' + (isVisited(it.p.id) ? 'true' : 'false') + '">✓</button>' +
      '<button type="button" class="tool" data-up="' + i + '" aria-label="' + esc(t('moveUp')) + '">↑</button>' +
      '<button type="button" class="tool" data-down="' + i + '" aria-label="' + esc(t('moveDown')) + '">↓</button>' +
      '<button type="button" class="tool" data-del="' + i + '" aria-label="' + esc(t('remove')) + '">×</button></div></div>';
  });
  html += '<div class="actions"><button type="button" class="btn" data-act="map">' + esc(t('planMap')) + '</button>' +
    '<button type="button" class="btn ghost" data-act="opt">' + esc(t('planOptimize')) + '</button>' +
    '<button type="button" class="btn ghost" data-act="ics">' + esc(t('planCalendar')) + '</button>' +
    '<button type="button" class="btn ghost" data-act="clear">' + esc(t('planClear')) + '</button></div>' +
    '<p class="where" style="margin-top:10px">' + esc(t('planNote')) + '</p>';
  $('plan-body').innerHTML = html;
}
function drawPlan() {
  if (!plan.stops.length) { clearRoute(); return; }
  drawRoute({ stops: plan.stops.map(function (id) { return { place: id }; }) });
}
function optimizePlan() {
  // Keep the first stop, then always go to the nearest remaining place.
  if (plan.stops.length < 3) return;
  var rest = plan.stops.slice(1), order = [plan.stops[0]];
  while (rest.length) {
    var last = place(order[order.length - 1]), bi = 0, bd = Infinity;
    rest.forEach(function (id, i) { var dd = haversineKm(last, place(id)); if (dd < bd) { bd = dd; bi = i; } });
    order.push(rest.splice(bi, 1)[0]);
  }
  plan.stops = order;
  planChanged();
}
function icsDate(d) { var p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + '00'; }
function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function downloadIcs() {
  var s = schedule(), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Istanbul Rota//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  s.items.forEach(function (it, i) {
    lines.push('BEGIN:VEVENT', 'UID:' + stamp + '-' + i + '@istanbul-rota', 'DTSTAMP:' + stamp,
      'DTSTART:' + icsDate(it.arrive), 'DTEND:' + icsDate(it.leave),
      'SUMMARY:' + icsText(tx(it.p.name)), 'LOCATION:' + icsText(it.p.district + ', İstanbul'),
      'GEO:' + it.p.lat + ';' + it.p.lng, 'DESCRIPTION:' + icsText(tx(it.p.note)), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'istanbul-rota-plan.ics';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
var clearArmed = false;
function onPlanClick(e) {
  var b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-goexplore')) { exploreMode = 'kesfet'; renderExplore(); location.hash = '#rotalar'; return; }
  if (b.hasAttribute('data-open')) { openPlace(b.getAttribute('data-open')); return; }
  if (b.hasAttribute('data-visit')) { toggleVisit(b.getAttribute('data-visit')); return; }
  var i;
  if (b.hasAttribute('data-up')) { i = +b.getAttribute('data-up'); if (i > 0) { plan.stops.splice(i - 1, 0, plan.stops.splice(i, 1)[0]); planChanged(); } return; }
  if (b.hasAttribute('data-down')) { i = +b.getAttribute('data-down'); if (i < plan.stops.length - 1) { plan.stops.splice(i + 1, 0, plan.stops.splice(i, 1)[0]); planChanged(); } return; }
  if (b.hasAttribute('data-del')) { plan.stops.splice(+b.getAttribute('data-del'), 1); planChanged(); return; }
  var act = b.getAttribute('data-act');
  if (act === 'map') { drawPlan(); setSheet('peek'); }
  else if (act === 'opt') optimizePlan();
  else if (act === 'ics') downloadIcs();
  else if (act === 'clear') {
    if (!clearArmed) { clearArmed = true; b.textContent = t('planClearConfirm'); setTimeout(function () { clearArmed = false; if (b.isConnected) b.textContent = t('planClear'); }, 4000); return; }
    clearArmed = false; plan.stops = []; planChanged();
  }
}

// ---------- Memories: visits, points, badges, levels (stored on this phone) ----------
var visits = {};
try { visits = JSON.parse(localStorage.getItem('rota-visits') || '{}') || {}; } catch (e) { visits = {}; }
function saveVisits() { try { localStorage.setItem('rota-visits', JSON.stringify(visits)); } catch (e) {} }
function isVisited(id) { return !!visits[id]; }
var LEVELS = [
  { min: 0, name: { tr: 'Yolcu', en: 'Traveller' } },
  { min: 60, name: { tr: 'Seyyah', en: 'Explorer' } },
  { min: 150, name: { tr: 'Rehber', en: 'Guide' } },
  { min: 300, name: { tr: 'İstanbul ustası', en: 'Istanbul master' } }
];
var ASIA = ['Kadıköy', 'Üsküdar', 'Adalar'];
var BADGES = [
  { id: 'first', color: '#1D9E75', name: { tr: 'İlk adım', en: 'First step' }, desc: { tr: '1 yer gez', en: 'Visit 1 place' }, ok: function (s) { return s.count >= 1; } },
  { id: 'five', color: '#185FA5', name: { tr: 'Beş durak', en: 'Five stops' }, desc: { tr: '5 yer gez', en: 'Visit 5 places' }, ok: function (s) { return s.count >= 5; } },
  { id: 'ten', color: '#534AB7', name: { tr: 'On durak', en: 'Ten stops' }, desc: { tr: '10 yer gez', en: 'Visit 10 places' }, ok: function (s) { return s.count >= 10; } },
  { id: 'history', color: '#7B3FA0', name: { tr: 'Tarihçi', en: 'Historian' }, desc: { tr: '3 müze ya da tarihi yer', en: '3 museums or historic sites' }, ok: function (s) { return (s.cat.muze || 0) + (s.cat.tarihi || 0) >= 3; } },
  { id: 'domes', color: '#0F7A6C', name: { tr: 'Kubbeler altında', en: 'Under the domes' }, desc: { tr: '3 cami', en: '3 mosques' }, ok: function (s) { return (s.cat.cami || 0) >= 3; } },
  { id: 'nature', color: '#2E8B3A', name: { tr: 'Doğa sever', en: 'Nature lover' }, desc: { tr: '2 doğa ve piknik yeri', en: '2 nature spots' }, ok: function (s) { return (s.cat.doga || 0) >= 2; } },
  { id: 'ferry', color: '#0E6BA8', name: { tr: 'Vapur yolcusu', en: 'Ferry rider' }, desc: { tr: '2 iskele', en: '2 ferry piers' }, ok: function (s) { return (s.cat.iskele || 0) >= 2; } },
  { id: 'continents', color: '#C77D1E', name: { tr: 'İki kıta', en: 'Two continents' }, desc: { tr: 'Hem Avrupa hem Asya yakası', en: 'Both the European and Asian side' }, ok: function (s) { return s.asia && s.europe; } },
  { id: 'route', color: '#B8325A', name: { tr: 'Rota bitirici', en: 'Route finisher' }, desc: { tr: 'Bir rotayı tamamla', en: 'Finish a route' }, ok: function (s) { return s.routes.length >= 1; } },
  { id: 'allroutes', color: '#993C1D', name: { tr: 'Tüm rotalar', en: 'All routes' }, desc: { tr: 'Bütün hazır rotaları bitir', en: 'Finish every ready route' }, ok: function (s) { return s.routes.length === DATA.routes.length; } }
];
function routeStopIds(r) { return r.stops.filter(function (s) { return s.place; }).map(function (s) { return s.place; }); }
function memStats() {
  var s = { count: 0, cat: {}, asia: false, europe: false, routes: [] };
  Object.keys(visits).forEach(function (id) {
    var p = place(id); if (!p) return;
    s.count++;
    s.cat[p.cat] = (s.cat[p.cat] || 0) + 1;
    if (ASIA.indexOf(p.district) >= 0) s.asia = true; else s.europe = true;
  });
  DATA.routes.forEach(function (r) { if (routeStopIds(r).every(isVisited)) s.routes.push(r.id); });
  s.points = s.count * 10 + s.routes.length * 50;
  return s;
}
function levelFor(points) { var l = 0; LEVELS.forEach(function (x, i) { if (points >= x.min) l = i; }); return l; }
function medal(color) {
  return '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M12 2h5l-3 9h-5zM24 2h-5l3 9h5z" fill="' + color + '" opacity=".6"/><circle cx="18" cy="22" r="11" fill="' + color + '"/><path d="m18 15 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="#fff"/></svg>';
}
var toastTimer = null;
function toast(msg) {
  var el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
}
function toggleVisit(id) {
  var before = memStats();
  if (visits[id]) delete visits[id]; else visits[id] = { date: new Date().toISOString() };
  saveVisits();
  var after = memStats(), msgs = [];
  if (visits[id]) {
    msgs.push(t('toastVisit', { name: tx(place(id).name) }));
    after.routes.forEach(function (rid) { if (before.routes.indexOf(rid) < 0) msgs.push(t('toastRoute', { name: tx(DATA.routes.filter(function (r) { return r.id === rid; })[0].name) })); });
    BADGES.forEach(function (b) { if (b.ok(after) && !b.ok(before)) msgs.push(t('toastBadge', { name: tx(b.name) })); });
  }
  // Show the newest news; when a route or badge was just earned, show it together with the one before it.
  if (msgs.length) toast(msgs.slice(-2).join(' · '));
  renderMemories(); renderPlan(); refreshMapPlaces();
}
function renderMemories() {
  var s = memStats(), li = levelFor(s.points), L = LEVELS[li], next = LEVELS[li + 1];
  var pct = next ? Math.round((s.points - L.min) / (next.min - L.min) * 100) : 100;
  var html = '<div class="level"><span class="pts">' + s.points + ' <small>' + esc(t('points')) + '</small></span><span class="name">' + esc(t('levelOf', { n: li + 1, name: tx(L.name) })) + '</span>' +
    '<div class="bar"><i style="width:' + pct + '%"></i></div><small>' + esc(next ? t('toNext', { p: next.min - s.points }) : t('maxLevel')) + '</small></div>';
  html += '<div class="section"><h3>' + esc(t('badgesH')) + '</h3><div class="badges">' + BADGES.map(function (b) {
    var got = b.ok(s);
    return '<div class="bdg' + (got ? '' : ' locked') + '">' + medal(got ? b.color : '#9AA3AE') + '<b>' + esc(tx(b.name)) + '</b><span>' + esc(tx(b.desc)) + '</span></div>';
  }).join('') + '</div></div>';
  html += '<div class="section"><h3>' + esc(t('routesH')) + '</h3>' + DATA.routes.map(function (r) {
    var ids = routeStopIds(r), done = ids.filter(isVisited).length;
    return '<div class="rprog"><div class="top"><span>' + esc(tx(r.name)) + '</span><span class="mono">' + done + '/' + ids.length + '</span></div><div class="bar"><i style="width:' + Math.round(done / ids.length * 100) + '%"></i></div></div>';
  }).join('') + '</div>';
  var list = Object.keys(visits).filter(function (id) { return place(id); }).sort(function (a, b) { return visits[b].date < visits[a].date ? -1 : 1; });
  html += '<div class="section"><h3>' + esc(t('historyH')) + '</h3>' + (list.length ? '<div class="vlist">' + list.map(function (id) {
    var p = place(id), d = new Date(visits[id].date);
    return '<div class="vitem"><span class="d">' + esc(d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' })) + '</span>' +
      '<button type="button" class="open" data-open="' + esc(id) + '" style="border:0;background:transparent;text-align:left;padding:0;cursor:pointer;color:inherit;font-weight:600">' + esc(tx(p.name)) + '</button>' +
      '<button type="button" class="tool" style="width:auto;padding:0 8px" data-unvisit="' + esc(id) + '">' + esc(t('undo')) + '</button></div>';
  }).join('') + '</div>' : '<p class="where">' + esc(t('noVisits')) + '</p>') + '</div><p class="where">' + esc(t('memNote')) + '</p>';
  $('view-anilar').innerHTML = html;
}
function onMemClick(e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-open')) openPlace(b.getAttribute('data-open'));
  else if (b.hasAttribute('data-unvisit')) toggleVisit(b.getAttribute('data-unvisit'));
}
function refreshMapPlaces() { if (map && overlaysReady) map.getSource('places').setData(placesGeoJSON()); }

// ---------- Trip mode: live location, distance, steps, nearby check-in, metro estimate ----------
var trip = { on: false, watchId: null, start: 0, last: null, meters: 0, motionSteps: 0, motionOK: false, dismissed: {}, wake: null, metro: null, metroForm: false, follow: true, timer: null, fix: false };
var mot = { avg: 9.8, lastPeak: 0, above: false };
function onMotion(e) {
  // Rough step counter: count peaks in the acceleration (only while the app is open).
  var a = e.accelerationIncludingGravity;
  if (!a || a.x === null) return;
  var m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z), now = Date.now();
  mot.avg = mot.avg * 0.9 + m * 0.1;
  if (!mot.above && m > mot.avg + 1.2 && now - mot.lastPeak > 300) { mot.above = true; mot.lastPeak = now; trip.motionSteps++; trip.motionOK = true; }
  else if (mot.above && m < mot.avg) mot.above = false;
}
function startTrip() {
  if (!navigator.geolocation) { toast(t('noGeo')); return; }
  trip.on = true; trip.start = Date.now(); trip.meters = 0; trip.motionSteps = 0; trip.motionOK = false; trip.last = null; trip.dismissed = {}; trip.fix = false; trip.follow = true;
  if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(function (s) { if (s === 'granted') window.addEventListener('devicemotion', onMotion); }).catch(function () {});
  } else if (window.DeviceMotionEvent) window.addEventListener('devicemotion', onMotion);
  trip.watchId = navigator.geolocation.watchPosition(onTripPos, function () { toast(t('noGeo')); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function (w) { trip.wake = w; }).catch(function () {});
  trip.timer = setInterval(renderTrip, 1000);
  renderTrip();
}
function stopTrip() {
  trip.on = false;
  if (trip.watchId !== null) navigator.geolocation.clearWatch(trip.watchId);
  trip.watchId = null; trip.metro = null; trip.metroForm = false;
  window.removeEventListener('devicemotion', onMotion);
  if (trip.wake) { trip.wake.release().catch(function () {}); trip.wake = null; }
  clearInterval(trip.timer);
  $('nearby').hidden = true;
  renderTrip();
}
function onTripPos(pos) {
  var p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy || 999 };
  myPos = p; trip.fix = true;
  if (trip.metro && p.acc < 50) { trip.metro = null; toast(t('metroExit')); }
  // Count distance only from good fixes and real moves (ignore GPS jitter and jumps).
  if (trip.last && p.acc <= 30) { var dm = haversineKm(trip.last, p) * 1000; if (dm >= 5 && dm < 200) trip.meters += dm; }
  if (p.acc <= 30 || !trip.last) trip.last = p;
  setMe();
  if (map && trip.follow) map.easeTo({ center: [p.lng, p.lat], padding: mapPadding(), duration: 600 });
  if (p.acc <= 60) checkNearby(p);
  renderTrip();
}
function checkNearby(p) {
  if (!$('nearby').hidden) return;
  var cands = plan.stops.map(place).filter(Boolean).concat(DATA.places);
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i];
    if (isVisited(c.id) || trip.dismissed[c.id]) continue;
    if (haversineKm(p, c) * 1000 <= 80) { showNearby(c); return; }
  }
}
function showNearby(c) {
  var el = $('nearby');
  el.innerHTML = '<b>' + esc(t('nearbyQ', { name: tx(c.name) })) + '</b><div class="row"><button type="button" class="btn" data-nvisit="' + esc(c.id) + '">' + esc(t('nearbyVisit')) + '</button>' +
    '<button type="button" class="btn ghost" data-nlater="' + esc(c.id) + '">' + esc(t('later')) + '</button></div>';
  el.hidden = false;
}
function onNearbyClick(e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-nvisit')) toggleVisit(b.getAttribute('data-nvisit'));
  else trip.dismissed[b.getAttribute('data-nlater')] = true;
  $('nearby').hidden = true;
}
function fmtDur(ms) { var m = Math.floor(ms / 60000); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
function metroState() {
  var M = trip.metro; if (!M) return null;
  var line = DATA.metro.lines.filter(function (l) { return l.id === M.line; })[0];
  var dir = M.to >= M.from ? 1 : -1, total = Math.abs(M.to - M.from);
  var passed = Math.min(total, Math.floor((Date.now() - M.t0) / 60000 / line.minPerStop));
  return { line: line, idx: M.from + dir * passed, left: total - passed, min: Math.max(0, Math.round(total * line.minPerStop - (Date.now() - M.t0) / 60000)) };
}
function renderTrip() {
  var el = $('trip-panel'); if (!el || !DATA) return;
  if (!trip.on) {
    el.innerHTML = '<div class="trip"><h3>' + esc(t('tripH')) + '</h3><p class="where">' + esc(t('tripIntro')) + '</p><div class="row"><button type="button" class="btn" data-trip="start">' + esc(t('tripStart')) + '</button></div></div>';
    return;
  }
  var steps = trip.motionOK ? trip.motionSteps : Math.round(trip.meters / 0.75);
  var html = '<div class="trip"><span class="live"><i></i>' + esc(trip.fix ? t('tripLive') : t('tripWaiting')) + '</span>' +
    '<div class="stats"><div><b>' + fmtDur(Date.now() - trip.start) + '</b><span>' + esc(t('tripTime')) + '</span></div>' +
    '<div><b>' + num(trip.meters / 1000, 2) + ' km</b><span>' + esc(t('tripKm')) + '</span></div>' +
    '<div><b>' + num(steps) + '</b><span>' + esc(t('tripSteps')) + '</span></div></div>';
  var nextId = plan.stops.filter(function (id) { return !isVisited(id); })[0];
  if (plan.stops.length) {
    if (nextId && myPos) {
      var np = place(nextId), km = haversineKm(myPos, np) * DATA.fares.roadFactor;
      html += '<div class="next"><span class="where">' + esc(t('tripNext')) + '</span><b>' + esc(tx(np.name)) + '</b><span class="where">' +
        esc(t('tripNextLine', { d: km < 1 ? Math.round(km * 1000) + ' m' : num(km, 1) + ' km', m: Math.max(1, Math.round(km / 4.5 * 60)) })) + '</span></div>';
    } else if (!nextId) html += '<div class="next"><b>' + esc(t('tripDone')) + '</b></div>';
  }
  var ms = metroState();
  if (ms) {
    if (ms.left === 0 && !trip.metro.told) { trip.metro.told = true; toast(t('metroArrive', { st: ms.line.stations[ms.idx] })); }
    html += '<div class="metro"><span class="where">' + esc(ms.line.name) + '</span><span class="est">' + esc(t('metroEst', { st: ms.line.stations[ms.idx] })) + '</span><span>' +
      esc(t('metroLeft', { n: ms.left, m: ms.min })) + '</span><span class="where">' + esc(t('metroNote')) + '</span><div class="row"><button type="button" class="btn ghost" data-trip="metro-off">' + esc(t('metroCancel')) + '</button></div></div>';
  } else if (trip.metroForm) {
    var cur = $('m-line') ? $('m-line').value : DATA.metro.lines[0].id;
    var line = DATA.metro.lines.filter(function (l) { return l.id === cur; })[0] || DATA.metro.lines[0];
    var opts = function (sel) { return line.stations.map(function (s, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join(''); };
    html += '<div class="metro"><label class="label" for="m-line">' + esc(t('metroLine')) + '</label><select id="m-line">' + DATA.metro.lines.map(function (l) { return '<option value="' + l.id + '"' + (l.id === line.id ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select>' +
      '<label class="label" for="m-from">' + esc(t('metroFrom')) + '</label><select id="m-from">' + opts(0) + '</select>' +
      '<label class="label" for="m-to">' + esc(t('metroTo')) + '</label><select id="m-to">' + opts(line.stations.length - 1) + '</select>' +
      '<div class="row"><button type="button" class="btn" data-trip="metro-go">' + esc(t('metroGo')) + '</button></div></div>';
  }
  html += '<div class="row">' + (!ms && !trip.metroForm ? '<button type="button" class="btn ghost" data-trip="metro">' + esc(t('metroBtn')) + '</button>' : '') +
    (trip.follow ? '' : '<button type="button" class="btn ghost" data-trip="follow">' + esc(t('follow')) + '</button>') +
    '<button type="button" class="btn ghost" data-trip="stop">' + esc(t('tripStop')) + '</button></div></div>';
  // Keep the metro form's choices while the panel refreshes every second.
  if (trip.metroForm && !ms && $('m-from') && el.contains($('m-from'))) return;
  el.innerHTML = html;
}
function onTripClick(e) {
  var b = e.target.closest('[data-trip]'); if (!b) return;
  var a = b.getAttribute('data-trip');
  if (a === 'start') startTrip();
  else if (a === 'stop') stopTrip();
  else if (a === 'follow') { trip.follow = true; if (myPos && map) map.easeTo({ center: [myPos.lng, myPos.lat], padding: mapPadding() }); renderTrip(); }
  else if (a === 'metro') { trip.metroForm = true; $('trip-panel').innerHTML = ''; renderTrip(); }
  else if (a === 'metro-go') {
    var from = +$('m-from').value, to = +$('m-to').value;
    if (from !== to) trip.metro = { line: $('m-line').value, from: from, to: to, t0: Date.now(), told: false };
    trip.metroForm = false; $('trip-panel').innerHTML = ''; renderTrip();
  }
  else if (a === 'metro-off') { trip.metro = null; renderTrip(); }
}
function onTripChange(e) {
  if (e.target.id === 'm-line') { $('trip-panel').innerHTML = ''; trip.metroForm = true; var v = e.target.value; renderTrip(); if ($('m-line')) $('m-line').value = v; renderTripForm(v); }
}
function renderTripForm(lineId) {
  var line = DATA.metro.lines.filter(function (l) { return l.id === lineId; })[0];
  ['m-from', 'm-to'].forEach(function (id, k) {
    $(id).innerHTML = line.stations.map(function (s, i) { return '<option value="' + i + '"' + (i === (k ? line.stations.length - 1 : 0) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  });
}

// ---------- Help: tourist first aid kit (content lives in DATA.help) ----------
var bigPhrase = null;
function renderHelp() {
  var H = DATA.help;
  if (!H) { $('view-yardim').innerHTML = ''; return; }
  var tagHtml = function (k) {
    return k === 'verified' ? '<span class="tag ok">' + esc(t('tagOk')) + '</span>' : k === 'unverified' ? '<span class="tag no">' + esc(t('tagNo')) + '</span>' : '<span class="tag tip">' + esc(t('tagTip')) + '</span>';
  };
  var html = '<div class="sos"><h2>' + esc(t('sosTitle')) + '</h2><p>' + esc(t('sosText')) + '</p><a href="tel:112">' + esc(t('sosCall')) + ' 112</a></div>';
  H.sections.forEach(function (s, si) {
    html += '<details class="hsec"' + (si === 0 ? ' open' : '') + '><summary>' + esc(tx(s.title)) + '</summary>';
    s.items.forEach(function (it) {
      html += '<div class="hitem"><h3>' + esc(tx(it.title)) + '</h3><p>' + esc(tx(it.text)) + '</p><div class="hactions">' + tagHtml(it.kind) +
        (it.call ? '<a class="btn small" href="tel:' + esc(it.call) + '">' + esc(t('call')) + ' ' + esc(it.call.replace(/^\+90/, '0')) + '</a>' : '') +
        (it.action ? '<a class="btn ghost small" href="' + esc(it.action) + '">' + esc(t('open')) + '</a>' : '') +
        (it.source ? '<a class="where link" target="_blank" rel="noopener" href="' + esc(it.source) + '">' + esc(t('source')) + '</a>' : '') + '</div></div>';
    });
    html += '</details>';
  });
  html += '<a class="asst-link" href="#asistan"><b>' + esc(t('asstTitle')) + '</b><span>' + esc(t(asstState() === 'ready' ? 'asstReadyShort' : 'asstNoBackendShort')) + '</span></a>';
  html += '<details class="hsec" id="phrasebook" open><summary>' + esc(t('phrasebook')) + '</summary><div class="hitem"><p class="where">' + esc(t('phraseHint')) + '</p>' +
    '<input type="search" id="phrase-q" placeholder="' + esc(t('phraseSearch')) + '" aria-label="' + esc(t('phraseSearch')) + '" value="' + esc(phraseQ) + '">' +
    '<div class="chips" id="phrase-groups" role="group" style="margin-bottom:0">' + H.phraseGroups.map(function (g) {
      return '<button type="button" class="chip small" data-pgroup="' + esc(g.id) + '" aria-pressed="' + (!phraseQ && g.id === phraseGroup) + '">' + esc(tx(g.title)) + '</button>';
    }).join('') + '</div></div><div id="phrase-list"></div></details>';
  $('view-yardim').innerHTML = html;
  var row = $('phrase-groups'), on = row.querySelector('[aria-pressed="true"]');
  if (on) row.scrollLeft = on.offsetLeft - row.offsetLeft - 16;   // keep the chosen category in view
  renderPhraseList();
}
// The phrasebook shows one category at a time, or the search results across all of them.
var phraseGroup = 'temel', phraseQ = '';
function allPhrases() {
  var out = [];
  DATA.help.phraseGroups.forEach(function (g) { g.phrases.forEach(function (p, i) { out.push({ key: g.id + ':' + i, p: p, g: g }); }); });
  return out;
}
function phraseByKey(k) {
  var parts = k.split(':'), g = DATA.help.phraseGroups.filter(function (x) { return x.id === parts[0]; })[0];
  return g ? g.phrases[+parts[1]] : null;
}
function fold(s) { return String(s).toLocaleLowerCase('tr-TR').replace(/[.,!?¿¡()/'’"-]/g, ' '); }
// Score phrases by how many of the typed words they contain (both Turkish and English sides).
function phraseMatches(text, max) {
  var words = fold(text).split(/\s+/).filter(function (w) { return w.length >= 2; });
  if (!words.length) return [];
  return allPhrases().map(function (x) {
    var hay = ' ' + fold(x.p.tr + ' ' + x.p.en) + ' ';
    var s = 0;
    words.forEach(function (w) { if (hay.indexOf(' ' + w) >= 0) s += w.length >= 4 ? 2 : 1; });
    return { x: x, s: s };
  }).filter(function (m) { return m.s > 0; }).sort(function (a, b) { return b.s - a.s || a.x.p.en.length - b.x.p.en.length; }).slice(0, max || 50).map(function (m) { return m.x; });
}
function phraseRow(x) {
  return '<div class="phrase"><b>' + esc(x.p.tr) + '</b><span>' + esc(x.p.en) + ' · <i>' + esc(x.p.say) + '</i></span><div class="pbtns">' +
    '<button type="button" class="tool" style="width:auto;padding:0 8px" data-say="' + esc(x.key) + '">' + esc(t('listen')) + '</button>' +
    '<button type="button" class="tool" style="width:auto;padding:0 8px" data-big="' + esc(x.key) + '">' + esc(t('showBig')) + '</button></div></div>';
}
function bigBox(p) { return '<div class="show-big"><b>' + esc(p.tr) + '</b><span>' + esc(p.en) + '</span></div>'; }
function renderPhraseList() {
  var box = $('phrase-list'); if (!box) return;
  var list = phraseQ ? phraseMatches(phraseQ) : allPhrases().filter(function (x) { return x.g.id === phraseGroup; });
  var big = bigPhrase ? phraseByKey(bigPhrase) : null;
  box.innerHTML = (big ? '<div class="hitem">' + bigBox(big) + '</div>' : '') +
    (phraseQ ? '<p class="where hitem">' + esc(list.length ? t('phraseFound', { n: list.length }) : t('phraseNone')) + '</p>' : '') +
    list.map(phraseRow).join('');
}
// Reads text aloud with the phone's own voices (works offline when the phone has the voice).
function sayIn(text, code) {
  if (!('speechSynthesis' in window)) return false;
  var u = new SpeechSynthesisUtterance(text);
  u.lang = code === 'tr' ? 'tr-TR' : code;
  u.rate = 0.9;
  var re = new RegExp('^' + code, 'i');
  var v = window.speechSynthesis.getVoices().filter(function (x) { return re.test(x.lang); })[0];
  if (v) u.voice = v;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
function sayTurkish(text) { return sayIn(text, 'tr'); }
function onHelpClick(e) {
  var g = e.target.closest('[data-pgroup]');
  if (g) { phraseGroup = g.getAttribute('data-pgroup'); phraseQ = ''; bigPhrase = null; renderHelp(); return; }
  var b = e.target.closest('[data-say],[data-big]');
  if (!b) return;
  var k = b.getAttribute('data-say') || b.getAttribute('data-big'), p = phraseByKey(k);
  if (!p) return;
  if (b.hasAttribute('data-say')) { if (!sayTurkish(p.tr)) alertSheet(t('noVoice')); return; }
  bigPhrase = bigPhrase === k ? null : k;
  renderPhraseList();
  var box = $('phrase-list').querySelector('.show-big');
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function onPhraseInput(e) {
  if (e.target.id !== 'phrase-q') return;
  phraseQ = e.target.value.trim(); bigPhrase = null;
  Array.prototype.forEach.call(document.querySelectorAll('#phrase-groups [data-pgroup]'), function (c) {
    c.setAttribute('aria-pressed', String(!phraseQ && c.getAttribute('data-pgroup') === phraseGroup));
  });
  renderPhraseList();
}

// ---------- Assistant (chat) and translator ----------
// Both need internet and the app's own small server, which holds the AI key (never the phone).
// Until ASSIST_URL is set, the screen works but says plainly that it is not ready.
var ASSIST_URL = 'https://istanbul-rota-asistan.istanbul-rota.workers.dev';
var ASSIST_COOLDOWN_MS = 4000;
var TR_LANGS = [
  { c: 'en', tr: 'İngilizce', en: 'English', n: 'English' }, { c: 'ar', tr: 'Arapça', en: 'Arabic', n: 'العربية' },
  { c: 'ru', tr: 'Rusça', en: 'Russian', n: 'Русский' }, { c: 'de', tr: 'Almanca', en: 'German', n: 'Deutsch' },
  { c: 'fr', tr: 'Fransızca', en: 'French', n: 'Français' }, { c: 'es', tr: 'İspanyolca', en: 'Spanish', n: 'Español' },
  { c: 'it', tr: 'İtalyanca', en: 'Italian', n: 'Italiano' }, { c: 'fa', tr: 'Farsça', en: 'Persian', n: 'فارسی' },
  { c: 'az', tr: 'Azerbaycan Türkçesi', en: 'Azerbaijani', n: 'Azərbaycanca' }, { c: 'tk', tr: 'Türkmence', en: 'Turkmen', n: 'Türkmençe' },
  { c: 'uk', tr: 'Ukraynaca', en: 'Ukrainian', n: 'Українська' }, { c: 'zh', tr: 'Çince', en: 'Chinese', n: '中文' },
  { c: 'ja', tr: 'Japonca', en: 'Japanese', n: '日本語' }, { c: 'ko', tr: 'Korece', en: 'Korean', n: '한국어' }
];
var asst = { mode: 'chat', msgs: [], busy: false, last: 0, share: { plan: false, loc: false }, dir: 'to', from: 'auto', to: 'en', tr: null };
try {
  var savedAsst = JSON.parse(localStorage.getItem('rota-asst') || '{}');
  if (savedAsst.share) asst.share = { plan: !!savedAsst.share.plan, loc: !!savedAsst.share.loc };
  if (savedAsst.to) asst.to = savedAsst.to;
} catch (e) {}
function saveAsst() { try { localStorage.setItem('rota-asst', JSON.stringify({ share: asst.share, to: asst.to })); } catch (e) {} }
function asstState() { return !ASSIST_URL ? 'nobackend' : navigator.onLine ? 'ready' : 'offline'; }
function langName(c) { var l = TR_LANGS.filter(function (x) { return x.c === c; })[0]; return l ? tx(l) + ' · ' + l.n : c; }

// What the server may see: only what the user ticked. Location is rounded (3 decimals ≈ 100 m).
function asstContext() {
  var ctx = { lang: lang, today: new Date().toISOString().slice(0, 10), weekday: new Date().getDay() };
  if (asst.share.plan && plan.stops.length) {
    var s = schedule();
    ctx.plan = s.items.map(function (it) { return { id: it.p.id, arrive: hhmm(it.arrive), day: it.arrive.getDay() }; });
  }
  if (asst.share.loc && myPos) ctx.near = { lat: Math.round(myPos.lat * 1000) / 1000, lng: Math.round(myPos.lng * 1000) / 1000 };
  return ctx;
}
// A random id for this phone, so the server can limit how often one phone asks. It says nothing about the person.
function deviceId() {
  try {
    var id = localStorage.getItem('rota-device');
    if (!id) {
      id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + String(Math.random()).slice(2, 10);
      localStorage.setItem('rota-device', id);
    }
    return id;
  } catch (e) { return ''; }
}
// One request to the app's server. Errors come back as a short code the screen can explain.
function askServer(path, body) {
  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
  var headers = { 'Content-Type': 'application/json' }, dev = deviceId();
  if (dev) headers['X-Device'] = dev;
  return fetch(ASSIST_URL.replace(/\/$/, '') + path, {
    method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
  }).then(function (r) {
    clearTimeout(timer);
    if (r.status === 429) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error(b.error === 'busy' ? 'busy' : 'limit'); });
    if (!r.ok) throw new Error('error');
    return r.json();
  }, function () { clearTimeout(timer); throw new Error('error'); });
}
function asstErrKey(err) { return err.message === 'limit' ? 'asstLimit' : err.message === 'busy' ? 'asstBusy' : 'asstError'; }
function cooledDown() {
  if (Date.now() - asst.last < ASSIST_COOLDOWN_MS) return false;
  asst.last = Date.now(); return true;
}
function asstNote(key) { asst.msgs.push({ role: 'note', text: t(key) }); }
function asstSend(text) {
  text = (text || '').trim();
  if (!text || asst.busy) return;
  var st = asstState();
  asst.msgs.push({ role: 'user', text: text });
  if (st !== 'ready') { asstNote(st === 'offline' ? 'asstOffline' : 'asstNoBackend'); renderAssistant(); return; }
  if (!cooledDown()) { asst.msgs.pop(); asstNote('asstWait'); renderAssistant(); return; }
  asst.busy = true; renderAssistant();
  var history = asst.msgs.filter(function (m) { return m.role === 'user' || m.role === 'assistant'; }).slice(-10)
    .map(function (m) { return { role: m.role, content: m.text }; });
  askServer('/chat', { messages: history, context: asstContext() }).then(function (r) {
    asst.msgs.push({ role: 'assistant', text: String(r.reply || '') });
  }, function (err) { asstNote(asstErrKey(err)); }).then(function () {
    asst.busy = false; renderAssistant();
  });
}
function asstTranslate(text) {
  text = (text || '').trim();
  if (!text) { asst.tr = { text: '', err: 'trEmpty' }; renderAssistant(); return; }
  var from = asst.dir === 'to' ? asst.from : 'tr', to = asst.dir === 'to' ? 'tr' : asst.to;
  // The phrasebook match runs on the phone, so there is always something useful offline.
  asst.tr = { text: text, from: from, to: to, matches: phraseMatches(text, 3), result: null, err: null };
  var st = asstState();
  if (st !== 'ready') { asst.tr.err = st === 'offline' ? 'asstOffline' : 'asstNoBackend'; renderAssistant(); return; }
  if (!cooledDown()) { asst.tr.err = 'asstWait'; renderAssistant(); return; }
  asst.busy = true; renderAssistant();
  askServer('/translate', { text: text, from: from, to: to }).then(function (r) {
    asst.tr.result = String(r.text || '');
  }, function (err) { asst.tr.err = asstErrKey(err); }).then(function () {
    asst.busy = false; renderAssistant();
  });
}
function renderAssistant() {
  var v = $('view-asistan'); if (!v || !DATA) return;
  var keep = { q: $('asst-q') ? $('asst-q').value : '', tx: $('tr-text') ? $('tr-text').value : (asst.tr ? asst.tr.text : '') };
  var st = asstState();
  var banner = st === 'ready' ? '' : '<div class="asst-banner"><p>' + esc(t(st === 'offline' ? 'asstOffline' : 'asstNoBackend')) + '</p>' +
    '<a class="btn ghost small" href="#yardim" data-goto="phrasebook">' + esc(t('asstToPhrasebook')) + '</a></div>';
  var html = '<h2 class="asst-h">' + esc(t('asstTitle')) + '</h2>' +
    '<div class="seg two" role="group"><button type="button" data-amode="chat" aria-pressed="' + (asst.mode === 'chat') + '">' + esc(t('asstChat')) + '</button>' +
    '<button type="button" data-amode="translate" aria-pressed="' + (asst.mode === 'translate') + '">' + esc(t('asstTranslate')) + '</button></div>' + banner;
  if (asst.mode === 'chat') {
    html += '<div class="bubbles" id="bubbles" aria-live="polite"><div class="msg bot">' + esc(t('asstHello')) + '</div>' +
      asst.msgs.map(function (m) {
        // Answers may mark words as **bold**; show that as bold, everything else as plain escaped text.
        var body = m.role === 'assistant' ? esc(m.text).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>') : esc(m.text);
        return '<div class="msg ' + (m.role === 'user' ? 'me' : m.role === 'assistant' ? 'bot' : 'note') + '" dir="auto">' + body + '</div>';
      }).join('') + (asst.busy ? '<div class="msg bot wait">' + esc(t('asstThinking')) + '</div>' : '') + '</div>';
    if (!asst.msgs.length) html += '<div class="chips">' + ['asstSug1', 'asstSug2', 'asstSug3'].map(function (k) {
      return '<button type="button" class="chip small" data-sug="' + k + '">' + esc(t(k)) + '</button>'; }).join('') + '</div>';
    html += '<form class="asst-form" id="asst-form"><textarea id="asst-q" rows="2" maxlength="600" placeholder="' + esc(t('asstPlaceholder')) + '" aria-label="' + esc(t('asstPlaceholder')) + '"></textarea>' +
      '<button class="btn" type="submit"' + (asst.busy ? ' disabled' : '') + '>' + esc(t('asstSend')) + '</button></form>' +
      '<div class="consent"><label><input type="checkbox" data-share="plan"' + (asst.share.plan ? ' checked' : '') + '> ' + esc(t('asstSharePlan')) + '</label>' +
      '<label><input type="checkbox" data-share="loc"' + (asst.share.loc ? ' checked' : '') + '> ' + esc(t('asstShareLoc')) + '</label>' +
      '<p class="where">' + esc(t('asstShareNote')) + '</p></div>' +
      (asst.msgs.length ? '<button type="button" class="back" data-aclear="1">' + esc(t('asstClear')) + '</button>' : '');
  } else {
    var opts = (asst.dir === 'to' ? '<option value="auto">' + esc(t('trAuto')) + '</option>' : '') + TR_LANGS.map(function (l) {
      var sel = (asst.dir === 'to' ? asst.from : asst.to) === l.c;
      return '<option value="' + l.c + '"' + (sel ? ' selected' : '') + '>' + esc(langName(l.c)) + '</option>';
    }).join('');
    html += '<div class="seg two" role="group"><button type="button" data-dir="to" aria-pressed="' + (asst.dir === 'to') + '">' + esc(t('trToTr')) + '</button>' +
      '<button type="button" data-dir="from" aria-pressed="' + (asst.dir === 'from') + '">' + esc(t('trFromTr')) + '</button></div>' +
      '<div class="field"><label for="tr-lang">' + esc(t('trLang')) + '</label><select id="tr-lang">' + opts + '</select></div>' +
      '<form class="field" id="tr-form" style="margin-top:10px"><label for="tr-text">' + esc(t('trInput')) + '</label>' +
      '<textarea id="tr-text" maxlength="1000" placeholder="' + esc(t('trInputPh')) + '"></textarea>' +
      '<button class="btn" type="submit"' + (asst.busy ? ' disabled' : '') + '>' + esc(asst.busy ? t('asstThinking') : t('trGo')) + '</button></form>';
    var r = asst.tr;
    if (r) {
      if (r.result) {
        html += '<div class="tr-out"><span class="label">' + esc(t('trResult')) + ' · ' + esc(r.to === 'tr' ? 'Türkçe' : langName(r.to)) + '</span><p class="tr-big" dir="auto">' + esc(r.result) + '</p>' +
          '<div class="hactions"><button type="button" class="btn ghost small" data-trsay="1">' + esc(t('trSay')) + '</button></div></div>';
      }
      if (r.err) html += '<p class="msg note" style="margin-top:12px">' + esc(t(r.err)) + '</p>';
      if (r.matches) {
        html += '<div class="hsec tr-matches"><p class="label" style="padding:10px 14px 0">' + esc(t('trMatches')) + '</p>' +
          (r.matches.length ? r.matches.map(phraseRow).join('') : '<p class="where hitem">' + esc(t('trNoMatch')) + '</p>') + '</div>';
      }
    }
  }
  html += '<p class="where asst-privacy">' + esc(t('asstPrivacy')) + '</p>';
  v.innerHTML = html;
  if ($('asst-q')) $('asst-q').value = keep.q;
  if ($('tr-text')) $('tr-text').value = keep.tx;
  var bub = $('bubbles'); if (bub && asst.msgs.length) bub.lastElementChild.scrollIntoView({ block: 'nearest' });
}
function onAsstClick(e) {
  var el = e.target.closest('[data-amode],[data-sug],[data-dir],[data-aclear],[data-trsay],[data-say],[data-big],[data-goto]');
  if (!el) return;
  if (el.hasAttribute('data-goto')) {   // the link itself opens #yardim; then jump to the phrasebook
    bigPhrase = null; phraseQ = '';
    setTimeout(function () { renderHelp(); var pb = $('phrasebook'); if (pb) pb.scrollIntoView({ block: 'start' }); }, 0);
    return;
  }
  if (el.hasAttribute('data-amode')) { asst.mode = el.getAttribute('data-amode'); renderAssistant(); return; }
  if (el.hasAttribute('data-sug')) { $('asst-q').value = t(el.getAttribute('data-sug')); $('asst-q').focus(); return; }
  if (el.hasAttribute('data-dir')) { asst.dir = el.getAttribute('data-dir'); asst.tr = null; renderAssistant(); return; }
  if (el.hasAttribute('data-aclear')) { asst.msgs = []; renderAssistant(); return; }
  if (el.hasAttribute('data-trsay')) { if (!sayIn(asst.tr.result, asst.tr.to)) alertSheet(t('noVoice')); return; }
  var p = phraseByKey(el.getAttribute('data-say') || el.getAttribute('data-big'));
  if (!p) return;
  if (el.hasAttribute('data-say')) { if (!sayTurkish(p.tr)) alertSheet(t('noVoice')); return; }
  // "Show" from the translator opens the same big card in the phrasebook.
  bigPhrase = el.getAttribute('data-big'); phraseQ = ''; phraseGroup = bigPhrase.split(':')[0];
  location.hash = '#yardim';
  setTimeout(function () { renderHelp(); var b = $('phrase-list') && $('phrase-list').querySelector('.show-big'); if (b) b.scrollIntoView({ block: 'center' }); }, 0);
}
function onAsstChange(e) {
  var s = e.target.getAttribute('data-share');
  if (s) { asst.share[s] = e.target.checked; saveAsst(); return; }
  if (e.target.id === 'tr-lang') {
    if (asst.dir === 'to') asst.from = e.target.value; else { asst.to = e.target.value; saveAsst(); }
  }
}
function onAsstSubmit(e) {
  e.preventDefault();
  if (e.target.id === 'asst-form') { var q = $('asst-q').value; $('asst-q').value = ''; asstSend(q); }
  if (e.target.id === 'tr-form') asstTranslate($('tr-text').value);
}
function onAsstKey(e) {
  // Enter sends, Shift+Enter makes a new line (chat box only).
  if (e.target.id === 'asst-q' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('asst-form').requestSubmit ? $('asst-form').requestSubmit() : onAsstSubmit({ preventDefault: function () {}, target: $('asst-form') }); }
}

// ---------- Rail: lines on the map and "which train, which direction" ----------
// data/rail.json is built by tools/build-rail.mjs from Metro İstanbul and İBB open data.
// In Istanbul the platform direction is signed with the line's LAST station, so every ride step
// names that station: "take M2 from the platform signed Hacıosman".
var RAIL = null, railIdx = null, railSel = { from: '', to: '' }, railResult = null;
function loadRail() {
  return fetch('data/rail.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { RAIL = d; buildRailIndex(); renderRail(); if (overlaysReady) addRailLayers(); })
    .catch(function () { RAIL = null; renderRail(); });
}
function railLine(id) { return railIdx.lines[id]; }
function lineLabel(l) { return l.label || l.id; }
function buildRailIndex() {
  var lines = {}, stops = {}, adj = {};
  RAIL.lines.forEach(function (l) {
    lines[l.id] = l;
    l.stations.forEach(function (s, i) {
      var k = l.id + ':' + i;
      adj[k] = [];
      (stops[s.n] = stops[s.n] || { n: s.n, c: s.c, nodes: [] }).nodes.push(k);
    });
  });
  RAIL.lines.forEach(function (l) {
    var hop = l.type && l.type.tr === 'Tramvay' ? 1.5 : l.stations.length === 2 ? 3 : 2;   // minutes, an estimate
    for (var i = 0; i < l.stations.length - 1; i++) {
      adj[l.id + ':' + i].push({ to: l.id + ':' + (i + 1), w: hop, ride: true });
      if (!l.loop) adj[l.id + ':' + (i + 1)].push({ to: l.id + ':' + i, w: hop, ride: true });
    }
    if (l.loop) adj[l.id + ':' + (l.stations.length - 1)].push({ to: l.id + ':0', w: hop, ride: true });
  });
  RAIL.transfers.forEach(function (t) {
    var w = 4 + t[4] / 70, a = t[0] + ':' + t[1], b = t[2] + ':' + t[3];
    adj[a].push({ to: b, w: w, m: t[4] }); adj[b].push({ to: a, w: w, m: t[4] });
  });
  railIdx = { lines: lines, stops: stops, adj: adj };
}
function nodeStation(k) { var p = k.split(':'); return railLine(p[0]).stations[+p[1]]; }
function nearestStop(pt) {
  var best = null, bd = Infinity;
  Object.keys(railIdx.stops).forEach(function (n) {
    var s = railIdx.stops[n], d = haversineKm({ lat: pt.lat, lng: pt.lng }, { lat: s.c[1], lng: s.c[0] });
    if (d < bd) { bd = d; best = s; }
  });
  return { stop: best, km: bd };
}
// Shortest trip (estimated minutes) from any platform of one stop to any platform of another.
function railRoute(fromStop, toStop) {
  var dist = {}, prev = {}, done = {}, targets = {};
  toStop.nodes.forEach(function (k) { targets[k] = true; });
  fromStop.nodes.forEach(function (k) { dist[k] = 0; });
  for (;;) {
    var u = null;
    Object.keys(dist).forEach(function (k) { if (!done[k] && (u === null || dist[k] < dist[u])) u = k; });
    if (u === null) return null;
    if (targets[u]) break;
    done[u] = true;
    railIdx.adj[u].forEach(function (e) {
      var nd = dist[u] + e.w;
      if (dist[e.to] === undefined || nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = { from: u, e: e }; }
    });
  }
  var path = [u];
  while (prev[path[0]]) path.unshift(prev[path[0]].from);
  // Turn the node path into ride and walk steps.
  var steps = [], i = 0;
  while (i < path.length - 1) {
    var a = path[i].split(':'), b = path[i + 1].split(':');
    if (a[0] === b[0]) {
      var j = i + 1;
      while (j < path.length - 1 && path[j + 1].split(':')[0] === a[0]) j++;
      steps.push({ ride: true, line: a[0], from: +a[1], to: +path[j].split(':')[1] });
      i = j;
    } else {
      steps.push({ walk: true, from: path[i], to: path[i + 1], m: prev[path[i + 1]].e.m || 0 });
      i++;
    }
  }
  // Changing between platforms of the very same station (e.g. M1A/M1B at Otogar) is not a real step.
  steps = steps.filter(function (s) { return !(s.walk && s.m === 0 && nodeStation(s.from).n === nodeStation(s.to).n); });
  return { steps: steps, min: Math.round(dist[u]) };
}
// The station the train is heading to: that is what the platform sign says.
function rideDirection(l, from, to) {
  if (l.loop) return null;
  return to > from ? l.stations[l.stations.length - 1].n : l.stations[0].n;
}
// Other lines that run the same stretch (M1A and M1B share Yenikapı–Otogar).
function rideAlternatives(step) {
  var l = railLine(step.line), a = l.stations[step.from].n, b = l.stations[step.to].n, out = [];
  RAIL.lines.forEach(function (o) {
    if (o.id === l.id) return;
    var ia = -1, ib = -1;
    o.stations.forEach(function (s, i) { if (s.n === a) ia = i; if (s.n === b) ib = i; });
    if (ia >= 0 && ib >= 0 && Math.abs(ib - ia) === Math.abs(step.to - step.from)) out.push({ line: o, dir: rideDirection(o, ia, ib) });
  });
  return out;
}
function textOn(hex) {
  var c = parseInt(hex.slice(1), 16), r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1A1A1A' : '#FFFFFF';
}
function lineBadge(l) {
  return '<span class="lbadge" style="background:' + esc(l.color) + ';color:' + textOn(l.color) + '">' + esc(lineLabel(l)) + '</span>';
}
function minutesOfDay(hhmm) { var p = String(hhmm || '').split(':'); return p.length === 2 ? (+p[0]) * 60 + (+p[1]) : null; }
function lineRunningNow(l) {
  if (!l.hours) return null;
  var f = minutesOfDay(l.hours.first), last = minutesOfDay(l.hours.last), d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  if (f === null || last === null) return null;
  if (last < f) last += 24 * 60;                  // last train after midnight
  if (now < f && now + 24 * 60 <= last) return true;
  return now >= f && now <= last;
}

// What the user can pick: "my location", places from the app, or any station.
function railChoices() {
  var out = [];
  Object.keys(railIdx.stops).sort(function (a, b) { return a.localeCompare(b, 'tr'); }).forEach(function (n) {
    var lines = railIdx.stops[n].nodes.map(function (k) { return lineLabel(railLine(k.split(':')[0])); })
      .filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    // Extra words people actually type: the new airport is "İstanbul Havalimanı"; the old Atatürk airport has no passenger flights.
    var hint = /^Yeni Havalimanı/.test(n) ? ' (' + t('railNewAirport') + ')' : /^Atatürk Havalimanı/.test(n) ? ' (' + t('railOldAirport') + ')' : '';
    out.push({ label: n + hint + ' · ' + lines.join(' '), kind: 'stop', stop: railIdx.stops[n] });
  });
  DATA.places.forEach(function (p) { out.push({ label: tx(p.name) + ' (' + t('railPlace') + ')', kind: 'place', place: p }); });
  return out;
}
function findChoice(text) {
  if (!text) return null;
  if (text === t('railMe')) return { kind: 'me' };
  var all = railChoices(), f = fold(text).trim();
  return all.filter(function (c) { return c.label === text; })[0] ||
    all.filter(function (c) { return fold(c.label).indexOf(f) === 0; })[0] ||
    all.filter(function (c) { return fold(c.label).indexOf(f) >= 0; })[0] || null;
}
// Resolve a choice to a stop, plus the walk to/from it when the choice is a place or the user's position.
function resolveChoice(c) {
  if (!c) return null;
  if (c.kind === 'stop') return { stop: c.stop, label: c.stop.n };
  var pt = c.kind === 'place' ? { lat: c.place.lat, lng: c.place.lng } : myPos;
  if (!pt) return null;
  var near = nearestStop(pt);
  return { stop: near.stop, walkKm: near.km, label: c.kind === 'place' ? tx(c.place.name) : t('railMe'), pt: pt };
}

function renderRail() {
  var box = $('rail-box'); if (!box || !DATA) return;
  if (!RAIL || !railIdx) { box.innerHTML = '<p class="where">' + esc(t('railLoading')) + '</p>'; return; }
  var opts = railChoices().map(function (c) { return '<option value="' + esc(c.label) + '">'; }).join('');
  var html = '<h3 class="rail-h">' + esc(t('railTitle')) + '</h3><p class="where">' + esc(t('railIntro')) + '</p>' +
    '<datalist id="rail-list"><option value="' + esc(t('railMe')) + '">' + opts + '</datalist>' +
    '<div class="field"><label for="rail-from">' + esc(t('railFrom')) + '</label><div class="row">' +
    '<input id="rail-from" list="rail-list" autocomplete="off" placeholder="' + esc(t('railPh')) + '" value="' + esc(railSel.from) + '">' +
    '<button type="button" class="btn ghost small" id="rail-me">' + esc(t('railUseMe')) + '</button></div></div>' +
    '<div class="field"><label for="rail-to">' + esc(t('railTo')) + '</label><div class="row">' +
    '<input id="rail-to" list="rail-list" autocomplete="off" placeholder="' + esc(t('railPh')) + '" value="' + esc(railSel.to) + '">' +
    '<button type="button" class="btn ghost small" id="rail-swap" aria-label="' + esc(t('railSwap')) + '">⇅</button></div></div>' +
    '<button type="button" class="btn" id="rail-go">' + esc(t('railGo')) + '</button>' +
    '<div id="rail-result" aria-live="polite"></div>' +
    '<p class="src">' + esc(t('railSource', { d: fmtDate(RAIL.updated) })) + '</p>';
  box.innerHTML = html;
  renderRailResult();
}
function renderRailResult() {
  var box = $('rail-result'); if (!box) return;
  var r = railResult;
  if (!r) { box.innerHTML = ''; return; }
  if (r.err) { box.innerHTML = '<p class="msg note" style="margin-top:12px">' + esc(t(r.err)) + '</p>'; return; }
  var rides = r.steps.filter(function (s) { return s.ride; }).length;
  var html = '<div class="rail-sum">' + esc(t('railSummary', { m: r.total, n: Math.max(0, rides - 1) })) + '</div><ol class="rail-steps">';
  if (r.startWalk) html += '<li class="rstep walk">' + esc(t('railWalkTo', { from: r.startWalk.from, to: r.startWalk.to, m: r.startWalk.m, min: r.startWalk.min })) + (r.startWalk.far ? ' <b>' + esc(t('railFar')) + '</b>' : '') + '</li>';
  r.steps.forEach(function (s) {
    if (s.walk) {
      var a = nodeStation(s.from), b = nodeStation(s.to), lb = railLine(s.to.split(':')[0]);
      html += '<li class="rstep walk">' + esc(t('railChange', { a: a.n, b: b.n, line: lineLabel(lb), m: Math.max(10, Math.round(s.m / 10) * 10) })) + '</li>';
      return;
    }
    var l = railLine(s.line), dir = rideDirection(l, s.from, s.to);
    var n = l.loop ? (s.to - s.from + l.stations.length) % l.stations.length : Math.abs(s.to - s.from);
    var alts = rideAlternatives(s), run = lineRunningNow(l);
    var between = [];
    if (!l.loop) { var st = s.from < s.to ? 1 : -1; for (var i = s.from + st; i !== s.to; i += st) between.push(l.stations[i].n); }
    html += '<li class="rstep ride" style="border-left-color:' + esc(l.color) + '">' +
      '<div class="rhead">' + lineBadge(l) + alts.map(function (a) { return ' ' + lineBadge(a.line); }).join('') + ' <span>' + esc(tx(l.name)) + '</span></div>' +
      (dir ? '<div class="sign" aria-label="' + esc(t('railSignLabel')) + '"><small>' + esc(t('railSignLabel')) + '</small><b>→ ' + esc(dir) + '</b>' +
        alts.filter(function (a) { return a.dir && a.dir !== dir; }).map(function (a) { return '<b class="alt">' + esc(t('railOr')) + ' → ' + esc(a.dir) + '</b>'; }).join('') + '</div>'
        : '<div class="sign"><b>' + esc(t('railLoop')) + '</b></div>') +
      '<p>' + esc(t('railRide', { from: l.stations[s.from].n, n: n, to: l.stations[s.to].n })) + '</p>' +
      (between.length ? '<details><summary>' + esc(t('railStops', { n: between.length })) + '</summary><p class="where">' + esc(between.join(' · ')) + '</p></details>' : '') +
      (l.hours ? '<p class="where">' + esc(t('railHours', { f: l.hours.first, l: l.hours.last })) + '</p>' : '') +
      (run === false ? '<p class="warn-line">' + esc(t('railNotNow')) + '</p>' : '') +
      (l.orderComputed ? '<p class="where">' + esc(t('railComputed')) + '</p>' : '') + '</li>';
  });
  if (r.endWalk) html += '<li class="rstep walk">' + esc(t('railWalkFrom', { from: r.endWalk.from, to: r.endWalk.to, m: r.endWalk.m, min: r.endWalk.min })) + (r.endWalk.far ? ' <b>' + esc(t('railFar')) + '</b>' : '') + '</li>';
  html += '</ol><p class="where">' + esc(t('railTip')) + '</p>';
  box.innerHTML = html;
}
function walkInfo(from, to, k) { var m = Math.round(k * 1300 / 10) * 10; return { from: from, to: to, m: m, min: Math.max(1, Math.round(m / 75)), far: k > 2 }; }
function railGo() {
  railSel.from = $('rail-from').value.trim(); railSel.to = $('rail-to').value.trim();
  var cf = findChoice(railSel.from), ct = findChoice(railSel.to);
  if (!cf || !ct) { railResult = { err: 'railPick' }; renderRailResult(); return; }
  if ((cf.kind === 'me' || ct.kind === 'me') && !myPos) {
    if (!navigator.geolocation) { railResult = { err: 'railNoPos' }; renderRailResult(); return; }
    railResult = { err: 'railLocating' }; renderRailResult();
    navigator.geolocation.getCurrentPosition(function (p) { myPos = { lat: p.coords.latitude, lng: p.coords.longitude }; if (map) setMe(); railGo(); },
      function () { railResult = { err: 'railNoPos' }; renderRailResult(); }, { enableHighAccuracy: true, timeout: 10000 });
    return;
  }
  var a = resolveChoice(cf), b = resolveChoice(ct);
  if (!a || !b) { railResult = { err: 'railPick' }; renderRailResult(); return; }
  if (a.stop === b.stop) { railResult = { err: 'railSame' }; renderRailResult(); return; }
  var r = railRoute(a.stop, b.stop);
  if (!r) { railResult = { err: 'railNone' }; renderRailResult(); return; }
  r.startWalk = a.walkKm !== undefined ? walkInfo(a.label, a.stop.n, a.walkKm) : null;
  r.endWalk = b.walkKm !== undefined ? walkInfo(b.stop.n, b.label, b.walkKm) : null;
  r.total = r.min + (r.startWalk ? r.startWalk.min : 0) + (r.endWalk ? r.endWalk.min : 0);
  r.ends = { a: a, b: b };
  railResult = r; renderRailResult(); drawRailRoute(r);
}

// ---------- Rail on the map ----------
function railLinesGeoJSON() {
  return { type: 'FeatureCollection', features: RAIL.lines.filter(function (l) { return l.geom && l.geom.length; }).map(function (l) {
    return { type: 'Feature', properties: { id: l.id, color: l.color }, geometry: { type: 'MultiLineString', coordinates: l.geom } };
  }) };
}
function railStationsGeoJSON() {
  return { type: 'FeatureCollection', features: Object.keys(railIdx.stops).map(function (n) {
    var s = railIdx.stops[n], l = railLine(s.nodes[0].split(':')[0]);
    return { type: 'Feature', properties: { n: n, color: l.color }, geometry: { type: 'Point', coordinates: s.c } };
  }) };
}
function addRailLayers() {
  if (!map || !RAIL || !railIdx || map.getSource('rail-lines')) return;
  map.addSource('rail-lines', { type: 'geojson', data: railLinesGeoJSON() });
  map.addLayer({ id: 'rail-lines', type: 'line', source: 'rail-lines', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 17, 6] } }, 'route-line');
  map.addSource('rail-route', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'rail-route', type: 'line', source: 'rail-route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 10], 'line-opacity': 0.95 } }, 'route-line');
  map.addSource('rail-stations', { type: 'geojson', data: railStationsGeoJSON() });
  map.addLayer({ id: 'rail-st', type: 'circle', source: 'rail-stations', minzoom: 12,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6], 'circle-color': '#FFFFFF', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2 } }, 'route-line');
  map.addLayer({ id: 'rail-st-label', type: 'symbol', source: 'rail-stations', minzoom: 13.5,
    layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13.5, 11, 17, 15], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
    paint: { 'text-color': '#1A1A1A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } }, 'route-line');
  map.addLayer({ id: 'rail-route-st', type: 'circle', source: 'rail-route', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 8, 'circle-color': '#FFFFFF', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 4 } });
  // Tap a station: which lines stop there.
  map.on('click', 'rail-st', function (e) {
    var n = e.features[0].properties.n, s = railIdx.stops[n];
    var badges = s.nodes.map(function (k) { return railLine(k.split(':')[0]); }).filter(function (l, i, arr) { return arr.indexOf(l) === i; }).map(lineBadge).join(' ');
    new maplibregl.Popup({ closeButton: true }).setLngLat(s.c).setHTML('<b>' + esc(n) + '</b><div style="margin-top:4px">' + badges + '</div>').addTo(map);
  });
  map.on('mouseenter', 'rail-st', function () { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'rail-st', function () { map.getCanvas().style.cursor = ''; });
  if (railResult && railResult.steps) drawRailRoute(railResult);
}
function drawRailRoute(r) {
  if (!map || !overlaysReady || !map.getSource('rail-route')) return;
  var feats = [], pts = [];
  r.steps.forEach(function (s) {
    if (!s.ride) return;
    var l = railLine(s.line), coords = [], st = s.from <= s.to ? 1 : -1;
    if (l.loop && s.to < s.from) { for (var i = s.from; i < l.stations.length; i++) coords.push(l.stations[i].c); for (i = 0; i <= s.to; i++) coords.push(l.stations[i].c); }
    else for (var j = s.from; j !== s.to + st; j += st) coords.push(l.stations[j].c);
    feats.push({ type: 'Feature', properties: { color: l.color }, geometry: { type: 'LineString', coordinates: coords } });
    [l.stations[s.from], l.stations[s.to]].forEach(function (x) { feats.push({ type: 'Feature', properties: { color: l.color }, geometry: { type: 'Point', coordinates: x.c } }); });
    pts = pts.concat(coords);
  });
  if (r.ends && r.ends.a.pt) pts.push([r.ends.a.pt.lng, r.ends.a.pt.lat]);
  if (r.ends && r.ends.b.pt) pts.push([r.ends.b.pt.lng, r.ends.b.pt.lat]);
  map.getSource('rail-route').setData({ type: 'FeatureCollection', features: feats });
  if (pts.length) {
    var b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    pts.forEach(function (p) { b.extend(p); });
    map.fitBounds(b, { padding: mapPadding(), maxZoom: 15 });
  }
}
function onRailClick(e) {
  if (e.target.id === 'rail-go') { railGo(); return; }
  if (e.target.id === 'rail-me') { $('rail-from').value = t('railMe'); return; }
  if (e.target.id === 'rail-swap') { var a = $('rail-from').value; $('rail-from').value = $('rail-to').value; $('rail-to').value = a; }
}

// ---------- Transport ----------
function renderTransportOptions() {
  ['from', 'to'].forEach(function (id) {
    var sel = $(id), cur = sel.value;
    var places = DATA.places.slice().sort(function (a, b) { return tx(a.name).localeCompare(tx(b.name), lang); });
    var opts = (myPos ? ['<option value="me">' + esc(t('myLocation')) + '</option>'] : []).concat(
      places.map(function (p) { return '<option value="' + p.id + '">' + esc(tx(p.name)) + ' (' + esc(p.district) + ')</option>'; }));
    sel.innerHTML = opts.join('');
    if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  });
  if (!$('from').dataset.init) { $('from').value = 'sultanahmet'; $('to').value = 'taksim'; $('from').dataset.init = '1'; setDistanceFromSelection(); }
}
function pointFor(v) { return v === 'me' ? myPos : place(v); }
function setDistanceFromSelection() {
  var a = pointFor($('from').value), b = pointFor($('to').value);
  if (!a || !b) return;
  var km = Math.max(1, Math.round(haversineKm(a, b) * DATA.fares.roadFactor));
  $('km').value = Math.min(km, Number($('km').max));
  calc();
}
function calc() {
  var f = DATA.fares;
  var km = Number($('km').value), wait = Number($('wait').value), fuel = Number($('fuel').value) || 0;
  $('km-val').textContent = km; $('wait-val').textContent = wait;
  var taxi = Math.max(f.taxi.min, f.taxi.start + km * f.taxi.perKm + (wait / 60) * f.taxi.perHourWait);
  var car = km * (f.car.litersPer100km / 100) * fuel;
  $('results').innerHTML =
    '<div class="result main"><strong>' + esc(t('taxi')) + '</strong><span class="amt">≈ ' + money(taxi) + '</span><span class="how">' +
      esc(t('taxiHow', { s: num(f.taxi.start, 2), k: num(f.taxi.perKm, 2), w: num(f.taxi.perHourWait, 2), m: num(f.taxi.min) })) + '</span></div>' +
    '<div class="result"><strong>' + esc(t('car')) + '</strong><span class="amt">≈ ' + money(car) + '</span><span class="how">' + esc(t('carHow', { l: f.car.litersPer100km })) + '</span></div>' +
    '<div class="result"><strong>' + esc(t('transit')) + '</strong>' +
      (f.transit ? '<span class="amt">' + num(f.transit.fullFare, 2) + ' TL <span style="font-size:13px">' + esc(t('perRide')) + '</span></span>'
                 : '<span class="amt" style="font-size:15px">' + esc(t('transitAmt')) + '</span>') +
      '<span class="how">' + esc(f.transit ? t('transitHow', { st: num(f.transit.studentFare, 2), single: num(f.transit.singleTicket), card: num(f.transit.cardPrice), ferry: num(f.transit.ferryKarakoyKadikoy, 2), d: fmtDate(f.transit.checked) }) : '') + '</span></div>';
  $('fare-src').innerHTML = esc(t('fareSrc', { d: fmtDate(f.taxi.checked) })) + ' <a href="' + esc(f.taxi.source) + '" target="_blank" rel="noopener">PDF</a>';
}

// ---------- Markets ----------
function renderMarkets() {
  var d = new Date().getDay();
  $('today-line').textContent = t('todayIs', { d: DAYS[lang][d] });
  var sel = $('district'), cur = sel.value || 'all';
  var districts = DATA.markets.map(function (m) { return m.district; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  sel.innerHTML = '<option value="all">' + esc(t('allDistricts')) + '</option>' + districts.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
  sel.value = cur;
  // A market can be held on several days (m.days); older data has a single m.day.
  function daysOf(m) { return m.days && m.days.length ? m.days : (m.day === null || m.day === undefined ? [] : [m.day]); }
  function nextIn(m) { var ds = daysOf(m); return ds.length ? Math.min.apply(null, ds.map(function (x) { return (x - d + 7) % 7; })) : 99; }
  var list = DATA.markets.filter(function (m) { return cur === 'all' || m.district === cur; }).sort(function (a, b) { return nextIn(a) - nextIn(b); });
  $('markets').innerHTML = list.length ? list.map(function (m) {
    var ds = daysOf(m), isToday = ds.indexOf(d) >= 0;
    var cls = !ds.length ? 'day unknown' : (isToday ? 'day today' : 'day');
    var label = !ds.length ? t('unknownDay') : (isToday ? t('today') : ds.map(function (x) { return DAYS[lang][x]; }).join(', '));
    return '<article class="market"><span class="' + cls + '">' + esc(label) + '</span><button type="button" class="card" data-market="' + esc(m.id) + '"><h3>' + esc(tx(m.name)) + '</h3><span class="where">' +
      esc(tx(m.where)) + ', ' + esc(m.district) + '</span><p>' + esc(tx(m.sells)) + '</p>' +
      (m.verified ? '' : '<div class="facts"><span class="fact check">' + esc(t('toVerify')) + '</span></div>') + '</button></article>';
  }).join('') : '<p class="where">' + esc(t('noMarkets')) + '</p>';
  Array.prototype.forEach.call($('markets').querySelectorAll('[data-market]'), function (el) {
    el.addEventListener('click', function () { openMarketOnMap(el.getAttribute('data-market')); });
  });
}

// ---------- Settings ----------
function renderSettings() {
  $('swatches').innerHTML = Object.keys(PALETTES).map(function (k) {
    var p = PALETTES[k], c = isDark() ? p.dark : p.light;
    return '<button type="button" class="swatch" data-palette="' + k + '" aria-pressed="' + (prefs.palette === k ? 'true' : 'false') + '"><span class="dots">' +
      '<i style="background:' + c.primary + '"></i><i style="background:' + c.accent + '"></i><i style="background:' + c.bg + '"></i></span>' + esc(tx(p.name)) + '</button>';
  }).join('');
  Array.prototype.forEach.call($('swatches').querySelectorAll('[data-palette]'), function (el) {
    el.addEventListener('click', function () { prefs.palette = el.getAttribute('data-palette'); savePrefs(); onThemeChange(); });
  });
  var labels = { auto: t('themeAuto'), light: t('themeLight'), dark: t('themeDark') };
  Array.prototype.forEach.call($('theme-seg').querySelectorAll('button'), function (el) {
    var k = el.getAttribute('data-theme');
    el.textContent = labels[k];
    el.setAttribute('aria-pressed', prefs.theme === k ? 'true' : 'false');
  });
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('install').hidden = !installEvent || standalone;
  $('install-hint').textContent = standalone ? t('installed') : (installEvent ? '' : (isIos ? t('installIos') : t('installOther')));
  $('about').textContent = t('about', { d: fmtDate(DATA.updated) });
}
function onThemeChange() {
  var wasDark = document.documentElement.style.colorScheme === 'dark';
  applyTheme();
  renderSettings();
  // The map's colours (route, stops, base map) follow the palette and theme.
  if (map) {
    if (wasDark !== isDark()) { resetMap(); }
    else if (overlaysReady) {
      var tk = tokens();
      map.setPaintProperty('route-line', 'line-color', tk.primary);
      map.setPaintProperty('route-stops', 'circle-color', tk.primary);
      map.setPaintProperty('route-num', 'text-color', tk['on-primary']);
    }
  }
}

// ---------- Reports ----------
function readReports() { try { return JSON.parse(localStorage.getItem('rota-reports') || '[]'); } catch (e) { return []; } }
function saveReport(text) {
  var list = readReports();
  list.push({ text: text, date: new Date().toISOString() });
  try { localStorage.setItem('rota-reports', JSON.stringify(list)); } catch (e) {}
  return list.length;
}

// ---------- Text, language ----------
function renderText() {
  document.documentElement.lang = lang;
  TABS.forEach(function (k) { $('tab-' + k).querySelector('span').textContent = t('tab' + k.charAt(0).toUpperCase() + k.slice(1)); });
  $('offline').textContent = t('offline');
  $('asst-btn').setAttribute('aria-label', t('asstTitle'));
  $('t-from').textContent = t('from'); $('t-to').textContent = t('to');
  $('t-km').textContent = t('km'); $('t-wait').textContent = t('wait'); $('t-min').textContent = t('min');
  $('t-fuel').textContent = t('fuel'); $('t-fuel-note').textContent = t('fuelNote');
  $('t-district').textContent = t('district');
  $('t-look').textContent = t('look'); $('t-palette').textContent = t('palette'); $('t-theme').textContent = t('theme');
  $('t-offline-map').textContent = t('offlineMap');
  $('t-package').textContent = t('package'); $('t-package-name').textContent = t('packageName'); $('t-package-note').textContent = t('packageNote');
  $('t-install-h').textContent = t('installH'); $('install').textContent = t('install');
  $('t-report-h').textContent = t('reportH'); $('t-report-label').textContent = t('reportLabel');
  $('t-report-send').textContent = t('reportSend'); $('report-copy').textContent = t('reportCopy');
  $('lang-tr').setAttribute('aria-pressed', lang === 'tr' ? 'true' : 'false');
  $('lang-en').setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
  renderRoutes(); renderExplore(); renderPlan(); renderTrip(); renderMemories(); renderHelp(); renderAssistant(); renderRail(); renderTransportOptions(); calc(); renderMarkets(); renderSettings(); renderMapStatus();
  if (!$('view-yer').hidden) showView(currentTab);
}
function setLang(l) {
  lang = l;
  try { localStorage.setItem('rota-lang', l); } catch (e) {}
  renderText();
  if (map) resetMap();   // map labels follow the chosen language
}
function updateOnline() { $('offline').hidden = navigator.onLine; renderMapStatus(); renderAssistant(); }

function bind() {
  $('lang-tr').addEventListener('click', function () { setLang('tr'); });
  $('lang-en').addEventListener('click', function () { setLang('en'); });
  $('handle').addEventListener('click', cycleSheet);
  window.addEventListener('hashchange', show);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (prefs.theme === 'auto') onThemeChange(); });
  $('locate').addEventListener('click', locate);
  // Explore and plan lists are re-rendered often, so their buttons use one delegated listener each.
  $('explore-seg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return;
    exploreMode = b.getAttribute('data-mode'); renderExplore();
  });
  $('cat-chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b) return;
    var k = b.getAttribute('data-cat'), i = filt.cats.indexOf(k);
    if (i >= 0) filt.cats.splice(i, 1); else filt.cats.push(k);
    renderExplore();
  });
  $('free-chip').addEventListener('click', function () { filt.free = !filt.free; renderExplore(); });
  $('explore-district').addEventListener('change', function () { filt.district = $('explore-district').value; renderExplore(); });
  $('explore-list').addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]'); if (add) { togglePlan(add.getAttribute('data-add')); return; }
    var open = e.target.closest('[data-open]'); if (open) openPlace(open.getAttribute('data-open'));
  });
  $('plan-body').addEventListener('click', onPlanClick);
  $('view-yardim').addEventListener('click', onHelpClick);
  $('view-yardim').addEventListener('input', onPhraseInput);
  $('view-asistan').addEventListener('click', onAsstClick);
  $('rail-box').addEventListener('click', onRailClick);
  $('rail-box').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); railGo(); } });
  $('view-asistan').addEventListener('change', onAsstChange);
  $('view-asistan').addEventListener('submit', onAsstSubmit);
  $('view-asistan').addEventListener('keydown', onAsstKey);
  $('view-anilar').addEventListener('click', onMemClick);
  $('trip-panel').addEventListener('click', onTripClick);
  $('trip-panel').addEventListener('change', onTripChange);
  $('nearby').addEventListener('click', onNearbyClick);
  Array.prototype.forEach.call(document.querySelectorAll('[data-start]'), function (b) {
    b.addEventListener('click', function () { plan.start = b.getAttribute('data-start'); planChanged(); });
  });
  $('plan-custom').addEventListener('change', function () { if ($('plan-custom').value) { plan.start = $('plan-custom').value; planChanged(); } });
  $('from').addEventListener('change', setDistanceFromSelection);
  $('to').addEventListener('change', setDistanceFromSelection);
  ['km', 'wait', 'fuel'].forEach(function (id) { $(id).addEventListener('input', calc); });
  $('district').addEventListener('change', renderMarkets);
  $('map-download').addEventListener('click', downloadMap);
  $('map-remove').addEventListener('click', removeMap);
  Array.prototype.forEach.call($('theme-seg').querySelectorAll('button'), function (el) {
    el.addEventListener('click', function () { prefs.theme = el.getAttribute('data-theme'); savePrefs(); onThemeChange(); });
  });
  $('report-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('report-text').value.trim();
    $('report-ok').hidden = false;
    if (!text) { $('report-ok').textContent = t('reportEmpty'); return; }
    $('report-ok').textContent = t('reportSaved', { n: saveReport(text) });
    $('report-text').value = '';
  });
  $('report-copy').addEventListener('click', function () {
    var text = $('report-text').value.trim();
    $('report-ok').hidden = false;
    if (!text) { $('report-ok').textContent = t('reportEmpty'); return; }
    var done = function () { $('report-ok').textContent = t('reportCopied'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { $('report-text').select(); });
    else $('report-text').select();
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; renderSettings(); });
  $('install').addEventListener('click', function () {
    if (!installEvent) return;
    installEvent.prompt();
    installEvent.userChoice.then(function () { installEvent = null; renderSettings(); });
  });
}

function start() {
  $('fuel').value = DATA.fares.car.fuelPriceExample;
  bind();
  renderText();
  updateOnline();
  show();
  // Map first: open it right away (from the saved offline copy when the phone has one).
  loadSavedMap().then(ensureMap, ensureMap);
  loadRail();
}

fetch('data/istanbul.json')
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(function (d) { DATA = d; start(); })
  .catch(function (err) {
    // Right after an update the phone can briefly mix an old saved page with new code.
    // If the page is missing something this code needs, reload once to get the matching page.
    var reloaded = false;
    try { reloaded = sessionStorage.getItem('rota-reloaded') === '1'; } catch (e) {}
    if (err instanceof TypeError && !reloaded) {
      try { sessionStorage.setItem('rota-reloaded', '1'); } catch (e) {}
      location.reload();
      return;
    }
    $('load-error').hidden = false; $('load-error').textContent = UI.loadError[lang];
  });
window.addEventListener('load', function () { setTimeout(function () { try { sessionStorage.removeItem('rota-reloaded'); } catch (e) {} }, 5000); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
