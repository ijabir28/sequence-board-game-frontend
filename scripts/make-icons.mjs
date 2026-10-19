// Draws the app icons in public/icons/ from the favicon's design (public/favicon.svg): a navy tile with a green chip.
// Browsers want PNGs for the install prompt and the home screen, and drawing three shapes needs no image library:
// each pixel is supersampled 4×4 for smooth edges, then written as a PNG with node's zlib.
//
//   node scripts/make-icons.mjs
//
// "any" icons keep the favicon's rounded corners; "maskable" ones fill the square, because Android crops them to its
// own shape (the chip stays inside the middle 80% safe zone), and iOS rounds the apple-touch-icon itself.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [0x0b, 0x13, 0x26];
const GREEN = [0x10, 0xb9, 0x81];
const DARK_GREEN = [0x00, 0x38, 0x24];

/** The favicon's 32-unit design: what colour (or nothing) lies at (x, y). */
function shade(x, y, rounded) {
  const r = rounded ? 6 : 0;
  // Outside the rounded tile's corners.
  const cx = Math.min(Math.max(x, r), 32 - r);
  const cy = Math.min(Math.max(y, r), 32 - r);
  if (r > 0 && Math.hypot(x - cx, y - cy) > r) return null;
  const d = Math.hypot(x - 16, y - 16);
  if (d <= 5 + 1 && d >= 5 - 1) return DARK_GREEN;
  if (d <= 9) return GREEN;
  return NAVY;
}

function render(size, rounded) {
  const SS = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let red = 0, green = 0, blue = 0, alpha = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = shade(((px + (sx + 0.5) / SS) / size) * 32, ((py + (sy + 0.5) / SS) / size) * 32, rounded);
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          alpha++;
        }
      }
      const i = (py * size + px) * 4;
      // Colours are averaged over the covered samples only, so edges fade out rather than darken.
      pixels[i] = alpha ? Math.round(red / alpha) : 0;
      pixels[i + 1] = alpha ? Math.round(green / alpha) : 0;
      pixels[i + 2] = alpha ? Math.round(blue / alpha) : 0;
      pixels[i + 3] = Math.round((alpha / (SS * SS)) * 255);
    }
  }
  return png(size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  // Each row starts with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, rounded] of icons) {
  writeFileSync(new URL(name, OUT), render(size, rounded));
  console.log(`public/icons/${name}`);
}
