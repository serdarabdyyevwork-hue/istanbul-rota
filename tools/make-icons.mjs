// Makes the app icons (PNG) with no extra packages: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

const COBALT = [31, 72, 168];
const WHITE = [255, 255, 255];
const AMBER = [233, 165, 74];

// A route line from bottom-left to top-right with a stop at each end (same as the prototype logo).
function curvePoints(s, inset) {
  const pts = [];
  const x0 = s * (0.2 + inset), x1 = s * (0.8 - inset);
  for (let i = 0; i <= 240; i++) {
    const u = i / 240;
    const x = x0 + (x1 - x0) * u;
    const y = s * (0.68 - 0.32 * u - 0.10 * Math.sin(u * Math.PI * 2));
    pts.push([x, y]);
  }
  return pts;
}
function distToPolyline(px, py, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const tt = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(px - (ax + tt * dx), py - (ay + tt * dy));
    if (d < best) best = d;
  }
  return best;
}
function draw(size, { maskable }) {
  const inset = maskable ? 0.06 : 0;
  const pts = curvePoints(size, inset);
  const start = pts[0], end = pts[pts.length - 1];
  const stroke = size * 0.055, dot = size * 0.075, radius = size * 0.22;
  return png(size, (x, y) => {
    if (!maskable) {
      const cx = Math.min(Math.max(x, radius), size - radius), cy = Math.min(Math.max(y, radius), size - radius);
      if (Math.hypot(x - cx, y - cy) > radius) return [0, 0, 0, 0];
    }
    if (Math.hypot(x - start[0], y - start[1]) < dot || Math.hypot(x - end[0], y - end[1]) < dot) return [...AMBER, 255];
    if (distToPolyline(x, y, pts) < stroke / 2) return [...WHITE, 255];
    return [...COBALT, 255];
  });
}

writeFileSync(join(outDir, 'icon-192.png'), draw(192, { maskable: false }));
writeFileSync(join(outDir, 'icon-512.png'), draw(512, { maskable: false }));
writeFileSync(join(outDir, 'maskable-512.png'), draw(512, { maskable: true }));
console.log('icons written to', outDir);
