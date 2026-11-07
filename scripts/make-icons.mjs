// Genera los íconos de la app de staff (PWA) en /public.
// Uso: node scripts/make-icons.mjs   (requiere la devDependency "sharp")
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (f) => path.join(root, "public", f);

// Entrada dorada con muesca y corona, sobre fondo negro. Solo trazos (sin fuentes).
function svg({ size, padding }) {
  const s = 512;
  const p = padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e2a6"/>
      <stop offset="0.5" stop-color="#d4a853"/>
      <stop offset="1" stop-color="#b8862e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#2a2110"/>
      <stop offset="1" stop-color="#050508"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#glow)"/>
  <g transform="translate(${p} ${p}) scale(${(s - 2 * p) / s})">
    <path fill="url(#g)" d="M96 150 h320 a24 24 0 0 1 24 24 v40 a42 42 0 0 0 0 84 v40 a24 24 0 0 1 -24 24 h-320 a24 24 0 0 1 -24 -24 v-40 a42 42 0 0 0 0 -84 v-40 a24 24 0 0 1 24 -24z"/>
    <path fill="#140f02" d="M176 300 l14 -84 l44 40 l22 -58 l22 58 l44 -40 l14 84 z"/>
    <rect x="176" y="310" width="160" height="16" rx="5" fill="#140f02"/>
    <g stroke="#140f02" stroke-width="5" stroke-dasharray="10 9" opacity="0.55">
      <line x1="372" y1="168" x2="372" y2="344"/>
    </g>
  </g>
</svg>`;
}

const tareas = [
  { file: "icon-192.png", size: 192, padding: 40 },
  { file: "icon-512.png", size: 512, padding: 40 },
  { file: "icon-maskable-512.png", size: 512, padding: 96 },
  { file: "apple-touch-icon.png", size: 180, padding: 40 },
];

for (const t of tareas) {
  await sharp(Buffer.from(svg(t))).png().toFile(out(t.file));
  console.log("✓", t.file);
}
