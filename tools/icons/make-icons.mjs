// Vẽ các hình PNG cho biểu tượng app (khi người chơi "cài" web ra màn hình chính) từ cùng hình logo R3 vương miện.
// Chạy: node tools/icons/make-icons.mjs (cần Playwright + Chromium). Sửa logo thì sửa ở đây, public/favicon.svg
// và src/components/BrandMark.tsx cho khớp, rồi chạy lại.
//
// - icon-192.png, icon-512.png ("any"): hình vuông tràn viền, máy tự bo góc theo kiểu của nó.
// - icon-maskable-512.png ("maskable"): vương miện thu nhỏ vào vòng an toàn giữa hình (80%) để máy Android cắt thành
//   tròn, vuông bo, giọt nước... mà không mất đỉnh vương miện.
// - apple-touch-icon.png: 180x180 cho iPhone, cùng kiểu với "any".
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Playwright có sẵn trong máy (không nằm trong package.json), nên nạp bằng require.
const { chromium } = createRequire(import.meta.url)('playwright');

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

const crown = `<path d="M17 41L15 25L24.5 33L32 21L39.5 33L49 25L47 41Z" fill="#121211" stroke="#121211" stroke-width="3" stroke-linejoin="round"/><rect x="16" y="44" width="32" height="6.5" rx="3.25" fill="#121211"/><circle cx="14.5" cy="21.5" r="3.6" fill="#121211"/><circle cx="49.5" cy="21.5" r="3.6" fill="#121211"/><circle cx="32" cy="16" r="4.2" fill="#ff5a1f"/>`;
const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdfcfa"/><stop offset=".55" stop-color="#ebe8e3"/><stop offset="1" stop-color="#d6d2cb"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>`;
// Vương miện chiếm khoảng x 11–53, y 12–51; tâm (32, 31.5). scale quanh tâm hình.
const svg = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}<g transform="translate(32 32) scale(${scale}) translate(-32 -31.5)">${crown}</g></svg>`;

const jobs = [
  ['icon-192.png', 192, svg(0.92)],
  ['icon-512.png', 512, svg(0.92)],
  ['apple-touch-icon.png', 180, svg(0.92)],
  ['icon-maskable-512.png', 512, svg(0.8)],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, s] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: path.join(out, name), omitBackground: false });
  console.log('ok', name);
}
await browser.close();
