'use strict';
// İstanbul Rota: all city content lives in data/istanbul.json. This file only draws it.

var VIEWS = ['rotalar', 'harita', 'ulasim', 'pazarlar'];
var DATA = null;
var lang = 'tr';
var routeId = null;
var map = null;
var myPos = null;
var installEvent = null;

try { var saved = localStorage.getItem('rota-lang'); if (saved === 'tr' || saved === 'en') lang = saved; } catch (e) {}

var UI = {
  sub: { tr: 'Gezi asistanı · deneme sürümü', en: 'Travel assistant · beta' },
  updated: { tr: 'Bilgiler {d} tarihinde kontrol edildi', en: 'Info checked on {d}' },
  offline: { tr: 'İnternet yok: kayıtlı bilgiler gösteriliyor', en: 'Offline: showing saved info' },
  install: { tr: 'Telefona yükle', en: 'Install app' },
  iosHint: { tr: 'iPhone\'a yüklemek için: Safari\'de Paylaş düğmesine, sonra "Ana Ekrana Ekle"ye dokun.', en: 'To install on iPhone: tap Share in Safari, then "Add to Home Screen".' },
  tabRotalar: { tr: 'Rotalar', en: 'Routes' },
  tabHarita: { tr: 'Harita', en: 'Map' },
  tabUlasim: { tr: 'Ulaşım', en: 'Transport' },
  tabPazarlar: { tr: 'Pazarlar', en: 'Markets' },
  showOnMap: { tr: 'Haritada göster', en: 'Show on map' },
  locate: { tr: 'Konumumu göster', en: 'Show my location' },
  showAll: { tr: 'Tüm yerler', en: 'All places' },
  locating: { tr: 'Konum alınıyor...', en: 'Getting your location...' },
  locateFail: { tr: 'Konum alınamadı. Telefonun ayarlarından konum iznini aç.', en: 'Could not get your location. Allow location access in your phone settings.' },
  mapNote: { tr: 'Harita verisi: © OpenStreetMap katkıcıları, Protomaps.', en: 'Map data: © OpenStreetMap contributors, Protomaps.' },
  mapOffline: { tr: 'Şu an internet yok. Haritayı daha önce indirdiysen çalışır; rotalar ve pazarlar her zaman çalışır.', en: 'No internet right now. The map works if you downloaded it earlier; routes and markets always work.' },
  mapDownload: { tr: 'Haritayı indir ({s} MB)', en: 'Download map ({s} MB)' },
  mapDownloading: { tr: 'İndiriliyor: {p}', en: 'Downloading: {p}' },
  mapDownloadFail: { tr: 'İndirme yarıda kaldı. İnternetini kontrol edip tekrar dene.', en: 'The download stopped. Check your connection and try again.' },
  mapSaved: { tr: 'İstanbul haritası telefonda kayıtlı. İnternetsiz çalışır.', en: 'The Istanbul map is saved on this phone. It works offline.' },
  mapOnline: { tr: 'Harita şu an internetten geliyor. İnternetsiz kullanmak için bir kez indir (Wi-Fi önerilir).', en: 'The map is loading over the internet. Download it once to use it offline (Wi-Fi recommended).' },
  mapNeedDownload: { tr: 'İnternet yok ve harita indirilmemiş. İnternete bağlanınca haritayı indir.', en: 'No internet and the map is not downloaded. Download it when you are back online.' },
  mapRemove: { tr: 'Haritayı sil', en: 'Delete map' },
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
  transitHow: { tr: 'İstanbulkart ile. Güncel tarife resmî kaynaktan eklenecek.', en: 'With an Istanbulkart. Current fares will be added from the official source.' },
  transitAmt: { tr: 'eklenecek', en: 'coming' },
  fareSrc: { tr: 'Taksi tarifesi kaynağı: İBB UKOME ({d} tarihinde kontrol edildi). Mesafe, kuş uçuşu mesafeden tahmin edilir; trafik ve güzergâha göre değişir.', en: 'Taxi fare source: IMM UKOME (checked {d}). Distance is estimated from the straight line and varies with traffic and route.' },
  district: { tr: 'İlçe', en: 'District' },
  allDistricts: { tr: 'Tüm ilçeler', en: 'All districts' },
  todayIs: { tr: 'Bugün {d}. Bugün kurulan pazarlar mavi.', en: 'Today is {d}. Markets open today are blue.' },
  today: { tr: 'Bugün', en: 'Today' },
  unknownDay: { tr: 'Gün?', en: 'Day?' },
  noMarkets: { tr: 'Bu ilçe için henüz pazar bilgisi yok.', en: 'No market info for this district yet.' },
  toVerify: { tr: 'doğrulanacak', en: 'to be verified' },
  approx: { tr: 'Konum yaklaşık', en: 'Approximate location' },
  report: { tr: 'Eksik ya da yanlış bilgi bildir', en: 'Report missing or wrong info' },
  reportLabel: { tr: 'Ne eksik ya da yanlış? (örnek: "Kirazlı pazarı perşembe kuruluyor")', en: 'What is missing or wrong? (e.g. "This market is on Thursdays")' },
  reportSend: { tr: 'Kaydet', en: 'Save' },
  reportCopy: { tr: 'Kopyala', en: 'Copy' },
  reportSaved: { tr: 'Kaydedildi. Bu telefonda bekleyen bildirim: {n}. Sunucu bağlanınca otomatik gönderilecek.', en: 'Saved. Reports waiting on this phone: {n}. They will be sent once the server is connected.' },
  reportCopied: { tr: 'Kopyalandı. WhatsApp veya e-postayla gönderebilirsin.', en: 'Copied. You can send it by WhatsApp or email.' },
  reportEmpty: { tr: 'Önce ne eksik olduğunu yaz.', en: 'Write what is missing first.' },
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
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function num(n, digits) { return Number(n).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 }); }
function money(n) { return num(Math.round(n)) + ' TL'; }
function fmtDate(iso) { var p = iso.split('-'); return lang === 'tr' ? p[2] + '.' + p[1] + '.' + p[0] : iso; }
function place(id) { return DATA.places.filter(function (p) { return p.id === id; })[0]; }
function haversineKm(a, b) {
  var R = 6371, r = function (x) { return x * Math.PI / 180; };
  var dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function factsHtml(p) {
  var out = (p.fees || []).map(function (f) {
    return '<span class="fact' + (f.verified ? '' : ' check') + '">' + esc(tx(f)) + '</span>';
  });
  if (p.approx) out.push('<span class="fact check">' + esc(t('approx')) + '</span>');
  return '<div class="facts">' + out.join('') + '</div>';
}

// ---------- Routes ----------
function renderRoutes() {
  var chips = $('route-chips');
  chips.innerHTML = '';
  DATA.routes.forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = tx(r.name);
    b.setAttribute('aria-pressed', r.id === routeId ? 'true' : 'false');
    b.addEventListener('click', function () { routeId = r.id; renderRoutes(); });
    chips.appendChild(b);
  });
  var r = DATA.routes.filter(function (x) { return x.id === routeId; })[0];
  var html = '<div class="route-head"><h2>' + esc(tx(r.name)) + '</h2><p>' + esc(tx(r.intro)) + '</p><div class="meta">' +
    tx(r.meta).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') +
    '<button type="button" class="link-btn" id="route-map">' + esc(t('showOnMap')) + ' →</button></div></div><ol class="stops">';
  var n = 0;
  r.stops.forEach(function (s) {
    if (s.leg) { html += '<li class="leg">' + esc(tx(s.leg)) + '</li>'; return; }
    var p = place(s.place);
    n++;
    html += '<li class="stop"><span class="dot">' + n + '</span><div class="card"><span class="when mono">' + esc(s.time) + ' · ' + esc(p.district) + '</span><h3>' +
      esc(tx(p.name)) + '</h3><p>' + esc(tx(p.note)) + '</p>' + factsHtml(p) + '</div></li>';
  });
  html += '</ol>';
  $('route').innerHTML = html;
  $('route-map').addEventListener('click', function () { location.hash = '#harita'; setTimeout(function () { drawRoute(r); }, 50); });
}

// ---------- Map: offline vector map from maps/istanbul.pmtiles ----------
var MAP_URL = 'maps/istanbul.pmtiles';
var MAP_CACHE = 'rota-map-v1';   // kept separately from the app cache so app updates never delete it
var MAP_MB = 50;
var mapFile = null;              // the saved map (Blob) when the phone has downloaded it
var pmProtocol = null;
var overlaysReady = false;
var pendingRoute = null;

function absUrl(p) { return new URL(p, location.href).href; }
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

function loadSavedMap() {
  if (!('caches' in window)) return Promise.resolve(null);
  return caches.open(MAP_CACHE)
    .then(function (c) { return c.match(absUrl(MAP_URL)); })
    .then(function (res) { return res ? res.blob() : null; })
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
    sources: {
      protomaps: {
        type: 'vector', url: url,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>'
      }
    },
    layers: basemaps.layers('protomaps', basemaps.namedFlavor('light'), { lang: lang })
  };
}

function ensureMap() {
  if (map || typeof window.maplibregl === 'undefined' || typeof window.pmtiles === 'undefined' || typeof window.basemaps === 'undefined') return;
  if (!pmProtocol) { pmProtocol = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', pmProtocol.tile); }
  overlaysReady = false;
  map = new maplibregl.Map({
    container: 'map', style: mapStyle(), center: [28.979, 41.015], zoom: 13,
    minZoom: 9, maxZoom: 18, maxBounds: [[28.45, 40.78], [29.45, 41.32]]
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  map.on('error', function (e) { console.warn('map error:', e && e.error ? (e.error.message || e.error) : e); });
  map.on('load', function () {
    addOverlays();
    if (pendingRoute) { var r = pendingRoute; pendingRoute = null; drawRoute(r); }
  });
}

function resetMap() {
  if (map) { map.remove(); map = null; overlaysReady = false; }
  if (!$('view-harita').hidden) ensureMap();
}

function placesGeoJSON() {
  var feats = DATA.places.map(function (p) {
    return { type: 'Feature', properties: { id: p.id, kind: 'place', color: DATA.categories[p.cat].color }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } };
  });
  DATA.markets.forEach(function (m) {
    if (m.lat === undefined) return;
    feats.push({ type: 'Feature', properties: { id: m.id, kind: 'market', color: '#C77D1E' }, geometry: { type: 'Point', coordinates: [m.lng, m.lat] } });
  });
  return { type: 'FeatureCollection', features: feats };
}

function addOverlays() {
  map.addSource('route', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1F48A8', 'line-width': 4, 'line-dasharray': [0.6, 1.8] } });
  map.addSource('places', { type: 'geojson', data: placesGeoJSON() });
  map.addLayer({ id: 'places', type: 'circle', source: 'places', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 8],
    'circle-color': ['case', ['==', ['get', 'kind'], 'market'], '#FFFFFF', ['get', 'color']],
    'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'market'], '#C77D1E', '#FFFFFF'],
    'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'market'], 3, 2] } });
  map.addLayer({ id: 'route-stops', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 11, 'circle-color': '#1F48A8', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'route-num', type: 'symbol', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#FFFFFF' } });
  map.addSource('me', { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#E5484D', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  map.on('click', 'places', function (e) {
    var f = e.features[0];
    var html = f.properties.kind === 'market' ? marketPopup(f.properties.id) : popupHtml(place(f.properties.id));
    new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(f.geometry.coordinates).setHTML(html).addTo(map);
  });
  map.on('mouseenter', 'places', function () { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'places', function () { map.getCanvas().style.cursor = ''; });
  overlaysReady = true;
  if (myPos) setMe();
}

function popupHtml(p) {
  var cat = DATA.categories[p.cat];
  return '<strong>' + esc(tx(p.name)) + '</strong><br><span style="opacity:.75">' + esc(tx(cat)) + ' · ' + esc(p.district) + '</span><br>' +
    esc(tx(p.note)) + '<br>' + (p.fees || []).map(function (f) { return esc(tx(f)) + (f.verified ? '' : ' (' + esc(t('toVerify')) + ')'); }).join('<br>');
}
function marketPopup(id) {
  var m = DATA.markets.filter(function (x) { return x.id === id; })[0];
  return '<strong>' + esc(tx(m.name)) + '</strong><br>' + esc(m.day === null ? t('unknownDay') : DAYS[lang][m.day]) + '<br>' + esc(tx(m.sells));
}

function renderLegend() {
  var legend = Object.keys(DATA.categories).map(function (k) {
    var c = DATA.categories[k];
    return '<span><i style="background:' + c.color + '"></i>' + esc(tx(c)) + '</span>';
  });
  legend.push('<span><i style="background:#FFFFFF;box-shadow:inset 0 0 0 3px #C77D1E"></i>' + esc(t('tabPazarlar')) + '</span>');
  $('legend').innerHTML = legend.join('');
}

function drawRoute(r) {
  ensureMap();
  if (!map) return;
  if (!overlaysReady) { pendingRoute = r; return; }
  var pts = r.stops.filter(function (s) { return s.place; }).map(function (s) { var p = place(s.place); return [p.lng, p.lat]; });
  var feats = [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }].concat(
    pts.map(function (c, i) { return { type: 'Feature', properties: { n: i + 1 }, geometry: { type: 'Point', coordinates: c } }; }));
  map.getSource('route').setData({ type: 'FeatureCollection', features: feats });
  var b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach(function (c) { b.extend(c); });
  map.fitBounds(b, { padding: 50, maxZoom: 16 });
}

function setMe() {
  if (!map || !overlaysReady || !myPos) return;
  map.getSource('me').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [myPos.lng, myPos.lat] } }] });
}

function locate() {
  if (!navigator.geolocation) { $('map-note').textContent = t('locateFail'); return; }
  $('map-note').textContent = t('locating');
  navigator.geolocation.getCurrentPosition(function (pos) {
    myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    $('map-note').textContent = t('mapNote');
    ensureMap();
    if (map) { setMe(); map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 }); }
    renderTransportOptions();
  }, function () { $('map-note').textContent = t('locateFail'); }, { enableHighAccuracy: true, timeout: 10000 });
}

function renderMapStatus() {
  var saved = !!mapFile;
  $('map-download').hidden = saved;
  $('map-download').disabled = false;
  $('map-download').textContent = t('mapDownload', { s: MAP_MB });
  $('map-remove').hidden = !saved;
  $('map-remove').textContent = t('mapRemove');
  $('map-status').className = saved ? 'saved' : '';
  $('map-status').textContent = saved ? t('mapSaved') : (navigator.onLine ? t('mapOnline') : t('mapNeedDownload'));
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
          if (r.done) return new Blob(chunks, { type: 'application/octet-stream' });
          chunks.push(r.value);
          got += r.value.length;
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
      renderMapStatus();
      resetMap();
    })
    .catch(function () {
      $('map-status').textContent = t('mapDownloadFail');
      $('map-download').disabled = false;
    });
}

function removeMap() {
  caches.open(MAP_CACHE).then(function (c) { return c.delete(absUrl(MAP_URL)); }).then(function () {
    mapFile = null;
    renderMapStatus();
    resetMap();
  });
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
  $('km-val').textContent = km;
  $('wait-val').textContent = wait;
  var taxi = Math.max(f.taxi.min, f.taxi.start + km * f.taxi.perKm + (wait / 60) * f.taxi.perHourWait);
  var car = km * (f.car.litersPer100km / 100) * fuel;
  $('results').innerHTML =
    '<div class="result main"><strong>' + esc(t('taxi')) + '</strong><span class="amt">≈ ' + money(taxi) + '</span><span class="how">' +
      esc(t('taxiHow', { s: num(f.taxi.start, 2), k: num(f.taxi.perKm, 2), w: num(f.taxi.perHourWait, 2), m: num(f.taxi.min) })) + '</span></div>' +
    '<div class="result"><strong>' + esc(t('car')) + '</strong><span class="amt">≈ ' + money(car) + '</span><span class="how">' + esc(t('carHow', { l: f.car.litersPer100km })) + '</span></div>' +
    '<div class="result"><strong>' + esc(t('transit')) + '</strong><span class="amt" style="font-size:15px">' + esc(t('transitAmt')) + '</span><span class="how">' + esc(t('transitHow')) + '</span></div>';
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
  var list = DATA.markets.filter(function (m) { return cur === 'all' || m.district === cur; }).sort(function (a, b) {
    var da = a.day === null ? 99 : (a.day - d + 7) % 7, db = b.day === null ? 99 : (b.day - d + 7) % 7;
    return da - db;
  });
  $('markets').innerHTML = list.length ? list.map(function (m) {
    var cls = m.day === null ? 'day unknown' : (m.day === d ? 'day today' : 'day');
    var label = m.day === null ? t('unknownDay') : (m.day === d ? t('today') : DAYS[lang][m.day]);
    return '<article class="market"><span class="' + cls + '">' + esc(label) + '</span><div class="card"><h3>' + esc(tx(m.name)) + '</h3><span class="where">' +
      esc(tx(m.where)) + ', ' + esc(m.district) + '</span><p>' + esc(tx(m.sells)) + '</p>' +
      (m.verified ? '' : '<div class="facts"><span class="fact check">' + esc(t('toVerify')) + '</span></div>') + '</div></article>';
  }).join('') : '<p class="where">' + esc(t('noMarkets')) + '</p>';
}

// ---------- Reports ----------
function readReports() { try { return JSON.parse(localStorage.getItem('rota-reports') || '[]'); } catch (e) { return []; } }
function saveReport(text) {
  var list = readReports();
  list.push({ text: text, date: new Date().toISOString() });
  try { localStorage.setItem('rota-reports', JSON.stringify(list)); } catch (e) {}
  return list.length;
}

// ---------- Text, language, views ----------
function renderText() {
  document.documentElement.lang = lang;
  $('t-sub').textContent = t('sub');
  $('updated').textContent = t('updated', { d: fmtDate(DATA.updated) });
  $('offline').textContent = t('offline');
  $('install').textContent = t('install');
  $('ios-hint').textContent = t('iosHint');
  ['rotalar', 'harita', 'ulasim', 'pazarlar'].forEach(function (k) {
    $('tab-' + k).querySelector('span').textContent = t('tab' + k.charAt(0).toUpperCase() + k.slice(1));
  });
  $('locate').textContent = t('locate');
  $('show-all').textContent = t('showAll');
  $('map-note').textContent = navigator.onLine ? t('mapNote') : t('mapOffline');
  $('t-from').textContent = t('from');
  $('t-to').textContent = t('to');
  $('t-km').textContent = t('km');
  $('t-wait').textContent = t('wait');
  $('t-min').textContent = t('min');
  $('t-fuel').textContent = t('fuel');
  $('t-fuel-note').textContent = t('fuelNote');
  $('t-district').textContent = t('district');
  $('report-open').textContent = t('report');
  $('t-report-label').textContent = t('reportLabel');
  $('t-report-send').textContent = t('reportSend');
  $('report-copy').textContent = t('reportCopy');
  $('lang-tr').setAttribute('aria-pressed', lang === 'tr' ? 'true' : 'false');
  $('lang-en').setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
  renderRoutes();
  renderTransportOptions();
  calc();
  renderMarkets();
  renderLegend();
  renderMapStatus();
}
function setLang(l) {
  lang = l;
  try { localStorage.setItem('rota-lang', l); } catch (e) {}
  renderText();
  if (map) resetMap();   // map labels follow the chosen language
}

function show() {
  var v = (location.hash || '#rotalar').slice(1);
  if (VIEWS.indexOf(v) < 0) v = 'rotalar';
  VIEWS.forEach(function (k) {
    $('view-' + k).hidden = k !== v;
    var a = $('tab-' + k);
    if (k === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (v === 'harita') { ensureMap(); if (map) setTimeout(function () { if (map) map.resize(); }, 0); }
}
function updateOnline() {
  $('offline').hidden = navigator.onLine;
  $('map-note').textContent = navigator.onLine ? t('mapNote') : t('mapOffline');
  renderMapStatus();
}

function bind() {
  $('lang-tr').addEventListener('click', function () { setLang('tr'); });
  $('lang-en').addEventListener('click', function () { setLang('en'); });
  window.addEventListener('hashchange', show);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  $('locate').addEventListener('click', locate);
  $('show-all').addEventListener('click', function () {
    ensureMap();
    if (!map) return;
    if (overlaysReady) map.getSource('route').setData(emptyFC());
    var b = new maplibregl.LngLatBounds([DATA.places[0].lng, DATA.places[0].lat], [DATA.places[0].lng, DATA.places[0].lat]);
    DATA.places.forEach(function (p) { b.extend([p.lng, p.lat]); });
    map.fitBounds(b, { padding: 30 });
  });
  $('map-download').addEventListener('click', downloadMap);
  $('map-remove').addEventListener('click', removeMap);
  $('from').addEventListener('change', setDistanceFromSelection);
  $('to').addEventListener('change', setDistanceFromSelection);
  ['km', 'wait', 'fuel'].forEach(function (id) { $(id).addEventListener('input', calc); });
  $('district').addEventListener('change', renderMarkets);
  $('report-open').addEventListener('click', function () { $('report-form').hidden = !$('report-form').hidden; });
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
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; $('install').hidden = false; });
  $('install').addEventListener('click', function () {
    if (!installEvent) return;
    installEvent.prompt();
    installEvent.userChoice.then(function () { installEvent = null; $('install').hidden = true; });
  });
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('ios-hint').hidden = !(isIos && !standalone);
}

function start() {
  $('fuel').value = DATA.fares.car.fuelPriceExample;
  routeId = DATA.routes[0].id;
  bind();
  renderText();
  updateOnline();
  // Use the saved offline map if the phone has one, then open the current tab.
  loadSavedMap().then(show, show);
}

fetch('data/istanbul.json')
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(function (d) { DATA = d; start(); })
  .catch(function () {
    $('load-error').hidden = false;
    $('load-error').textContent = UI.loadError[lang];
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
