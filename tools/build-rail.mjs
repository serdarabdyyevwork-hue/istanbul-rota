// Builds data/rail.json (rail lines, ordered stations, colors, simplified map geometry) from official open data.
// Run when the network changes (yearly is enough):
//   1. Download into one folder (see README, "Metro verisini güncellemek"):
//      hatlar.geojson, istasyon.geojson  (İBB Açık Veri: Raylı Sistem Hatları / İstasyon Noktaları)
//      GetStations.json, GetLines.json    (Metro İstanbul API: .../MetroMobile/V2/GetStations, GetLines)
//   2. node tools/build-rail.mjs <that folder>
// Station order and colors for Metro İstanbul lines come straight from Metro İstanbul. Lines run by others
// (Marmaray, M11, F2, Sirkeci–Kazlıçeşme) are not in that service: their stations come from İBB and the order
// is the shortest path between the two end stations; the script prints its length next to the official length.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/build-rail.mjs <folder with the 4 downloaded files>'); process.exit(1); }
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const HAT = read('hatlar.geojson'), IST = read('istasyon.geojson');
const MI_ST = read('GetStations.json').Data, MI_LN = read('GetLines.json').Data;
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const hex = (c) => '#' + [c.Color_R, c.Color_G, c.Color_B].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();

// ---------- Geometry: simplify (Douglas–Peucker, ~8 m) and round ----------
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = -1, bi = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy || 1e-18;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - x1) * dx + (pts[i][1] - y1) * dy) / len));
      const d = Math.hypot(pts[i][0] - (x1 + t * dx), pts[i][1] - (y1 + t * dy));
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function geomFor(match) {
  const parts = [];
  HAT.features.filter((f) => f.properties.PROJE_ASAMA !== 'İnşaat Aşamasında' && match(f.properties.PROJE_ADI || '')).forEach((f) => {
    const g = f.geometry, list = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    list.forEach((p) => { const s = simplify(p, 0.00008).map((c) => [r5(c[0]), r5(c[1])]); if (s.length > 1) parts.push(s); });
  });
  return parts;
}

// ---------- Lines from Metro İstanbul (official order, colors, hours) ----------
const T = (tr, en) => ({ tr, en });
const TYPE = { M: T('Metro', 'Metro'), T: T('Tramvay', 'Tram'), F: T('Füniküler', 'Funicular'), TF: T('Teleferik', 'Cable car'), B: T('Banliyö treni', 'Commuter rail') };
const lines = [];
const geomKey = (code) => (name) => name.startsWith(code + ' ') || name.startsWith(code + '(');
for (const ln of MI_LN.filter((l) => l.IsActive !== false).sort((a, b) => a.Order - b.Order)) {
  const st = MI_ST.filter((s) => s.LineName === ln.Name).sort((a, b) => a.Order - b.Order)
    .map((s) => ({ n: s.Description.trim(), c: [r5(+s.DetailInfo.Longitude), r5(+s.DetailInfo.Latitude)] }));
  if (st.length < 2) continue;
  const kind = ln.Name.replace(/\d.*$/, '');
  const base = { color: hex(ln.Color), colorOfficial: true, hours: { first: ln.FirstTime, last: ln.LastTime }, operator: 'Metro İstanbul', source: 'metro', type: TYPE[kind] || TYPE.M };
  if (ln.Name === 'M2') {
    // Seyrantepe is a branch: per Metro İstanbul, change at Sanayi Mahallesi.
    const main = st.filter((s) => s.n !== 'Seyrantepe');
    const sanayi = st.find((s) => s.n === 'Sanayi Mahallesi'), sey = st.find((s) => s.n === 'Seyrantepe');
    lines.push({ id: 'M2', name: T(ln.LongDescription.replace(/-Seyrantepe/, ''), ln.ENDescription.replace(/-Seyrantepe/, '')), ...base, stations: main, geom: geomFor(geomKey('M2')) });
    if (sanayi && sey) lines.push({ id: 'M2S', label: 'M2', name: T('M2 Sanayi Mahallesi–Seyrantepe kolu', 'M2 Sanayi Mahallesi–Seyrantepe branch'), ...base, stations: [sanayi, sey], geom: [] });
    continue;
  }
  lines.push({ id: ln.Name, name: T(ln.LongDescription, ln.ENDescription), ...base, loop: ln.Name === 'T3', stations: st, geom: geomFor(geomKey(ln.Name)) });
}

// ---------- Lines from İBB only (order = shortest path between the two end stations) ----------
function ibbStations(projectRe) {
  const seen = new Set();
  return IST.features.filter((f) => f.properties.PROJE_ASAMA !== 'İnşaat Aşamasında' && projectRe.test(f.properties.PROJE_ADI || ''))
    .map((f) => ({ n: f.properties.ISTASYON.replace(/\s+/g, ' ').trim(), c: [r5(f.geometry.coordinates[0]), r5(f.geometry.coordinates[1])] }))
    .filter((s) => (seen.has(s.n) ? false : seen.add(s.n)));
}
function orderPath(st, first, last) {
  const a = st.find((s) => s.n === first), b = st.find((s) => s.n === last);
  if (!a || !b) throw new Error('end station missing: ' + first + ' / ' + last + ' in ' + st.map((s) => s.n).join(', '));
  let rest = st.filter((s) => s !== a && s !== b), route = [a];
  while (rest.length) {   // nearest neighbour…
    const cur = route[route.length - 1]; let bi = 0;
    rest.forEach((s, i) => { if (km(cur.c, s.c) < km(cur.c, rest[bi].c)) bi = i; });
    route.push(rest.splice(bi, 1)[0]);
  }
  route.push(b);
  const len = (r) => r.slice(1).reduce((s, x, i) => s + km(r[i].c, x.c), 0);
  for (let improved = true; improved;) {   // …then 2-opt with both ends fixed
    improved = false;
    for (let i = 1; i < route.length - 2; i++) for (let j = i + 1; j < route.length - 1; j++) {
      const d = km(route[i - 1].c, route[j].c) + km(route[i].c, route[j + 1].c) - km(route[i - 1].c, route[i].c) - km(route[j].c, route[j + 1].c);
      if (d < -1e-9) { route = route.slice(0, i).concat(route.slice(i, j + 1).reverse(), route.slice(j + 1)); improved = true; }
    }
  }
  return { route, length: len(route) };
}
const OTHER = [
  { id: 'MARMARAY', label: 'Marmaray', re: /Marmaray/, ends: ['Halkalı', 'Gebze'], kind: 'B', name: T('Marmaray Halkalı–Gebze', 'Marmaray Halkalı–Gebze'), operator: 'TCDD Taşımacılık', color: '#5B7FA6', geo: (n) => /Marmaray/.test(n) },
  { id: 'M11', re: /^M11 /, ends: ['Gayrettepe', 'Halkalı'], kind: 'M', name: T('M11 Gayrettepe–İstanbul Havalimanı–Halkalı', 'M11 Gayrettepe–Istanbul Airport–Halkalı'), operator: 'TCDD / Ulaştırma Bakanlığı', color: '#8A8D91', geo: (n) => n.startsWith('M11 ') },
  { id: 'SK', label: 'Sirkeci–Kazlıçeşme', re: /^Sirkeci - Kazlıçeşme/, ends: ['Sirkeci', 'Kazlıçeşme'], kind: 'B', name: T('Sirkeci–Kazlıçeşme raylı sistemi', 'Sirkeci–Kazlıçeşme rail line'), operator: 'TCDD Taşımacılık', color: '#2E8B8B', geo: (n) => n.startsWith('Sirkeci - Kazlıçeşme') },
  { id: 'F2', re: /^F2 /, ends: ['Karaköy', 'Tünel'], kind: 'F', name: T('F2 Karaköy–Tünel (Beyoğlu) füniküleri', 'F2 Karaköy–Tünel (Beyoğlu) funicular'), operator: 'İETT', color: '#7C7358', geo: (n) => n.startsWith('F2 ') }
];
const report = [];
for (const o of OTHER) {
  const st = ibbStations(o.re), { route, length } = orderPath(st, o.ends[0], o.ends[1]);
  const official = HAT.features.find((f) => o.geo(f.properties.PROJE_ADI || ''));
  report.push(o.id + ': ' + route.length + ' stations, path ' + length.toFixed(1) + ' km, official line length ' + (official && official.properties.UZUNLUK) + ' km\n   ' + route.map((s) => s.n).join(' > '));
  lines.push({ id: o.id, label: o.label, name: o.name, type: TYPE[o.kind], color: o.color, colorOfficial: false, hours: null, operator: o.operator, source: 'ibb', orderComputed: true, stations: route, geom: geomFor(o.geo) });
}

// ---------- Transfers ----------
// A walkable change between two lines: stations within 350 m, or with the same name within 900 m
// (e.g. Bostancı M4/M8/Marmaray). From each station only the nearest station of each other line is kept.
const all = [];
lines.forEach((l) => l.stations.forEach((s, i) => all.push({ line: l.id, i, s })));
const norm = (n) => n.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();
const best = new Map();   // "line:i>otherLine" -> [line, i, otherLine, j, metres]
for (const A of all) for (const B of all) {
  if (A.line === B.line) continue;
  const d = km(A.s.c, B.s.c);
  if (!(d <= 0.35 || (d <= 0.9 && norm(A.s.n) === norm(B.s.n)))) continue;
  const k = A.line + ':' + A.i + '>' + B.line, cur = best.get(k);
  if (!cur || d * 1000 < cur[4]) best.set(k, [A.line, A.i, B.line, B.i, Math.round(d * 1000)]);
}
// Keep a pair when each station is the other's nearest on that line, or when both have the same name.
const seenPair = new Set(), transfers = [];
const stName = (line, i) => lines.find((l) => l.id === line).stations[i].n;
for (const t of best.values()) {
  const back = best.get(t[2] + ':' + t[3] + '>' + t[0]);
  const mutual = back && back[3] === t[1];
  if (!mutual && norm(stName(t[0], t[1])) !== norm(stName(t[2], t[3]))) continue;
  const key = [t[0] + ':' + t[1], t[2] + ':' + t[3]].sort().join('|');
  if (!seenPair.has(key)) { seenPair.add(key); transfers.push(t); }
}

const out = {
  updated: new Date().toISOString().slice(0, 10),
  sources: [
    { name: 'Metro İstanbul (istasyon sırası, renk, çalışma saatleri)', url: 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetStations' },
    { name: 'İBB Açık Veri: Raylı Sistem Hatları / İstasyon Noktaları (Kasım 2026)', url: 'https://data.ibb.gov.tr/dataset/rayli-sistem-istasyon-noktalari-verisi' }
  ],
  lines, transfers
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'rail.json');
fs.writeFileSync(file, JSON.stringify(out));
// The "metro" block in istanbul.json (used by trip mode's station estimate and read by the assistant):
// station names in order for every line with 3+ stations. Minutes per stop stay an estimate.
const cityFile = path.join(path.dirname(file), 'istanbul.json');
const city = JSON.parse(fs.readFileSync(cityFile, 'utf8'));
city.metro = {
  note: { tr: 'İstasyon sıraları Metro İstanbul ve İBB açık verisinden (' + out.updated + '). Marmaray, M11 ve Sirkeci–Kazlıçeşme sırası konumdan hesaplandı. Duraklar arası süre (2 dk) tahminidir.', en: 'Station order from Metro İstanbul and İBB open data (' + out.updated + '). Marmaray, M11 and Sirkeci–Kazlıçeşme order worked out from station positions. Time between stops (2 min) is an estimate.' },
  lines: lines.filter((l) => l.stations.length >= 3 && !l.loop).map((l) => ({
    id: l.label || l.id, name: l.name.tr.startsWith(l.label || l.id) ? l.name.tr : (l.label || l.id) + ' ' + l.name.tr, minPerStop: 2,
    verified: !l.orderComputed, hours: l.hours, stations: l.stations.map((s) => s.n)
  }))
};
fs.writeFileSync(cityFile, JSON.stringify(city, null, 2) + '\n');

console.log(report.join('\n'));
console.log(lines.length + ' lines, ' + all.length + ' stations, ' + transfers.length + ' transfer pairs, ' + Math.round(fs.statSync(file).size / 1024) + ' KB -> ' + file);
