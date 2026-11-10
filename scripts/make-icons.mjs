// Genera los íconos de la app de staff (PWA) y el favicon.
// Uso:
//   node scripts/make-icons.mjs --from public/marca/isotipo-claro.png   (isotipo de la marca sobre negro)
//   node scripts/make-icons.mjs                                          (ícono genérico de entrada dorada)
// Requiere la devDependency "sharp".
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (f) => path.join(root, "public", f);
const fromIdx = process.argv.indexOf("--from");
const from = fromIdx > -1 ? path.resolve(root, process.argv[fromIdx + 1]) : null;
const FONDO = { r: 5, g: 5, b: 8, alpha: 1 };

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

/** Isotipo centrado sobre fondo negro, con `margen` (0–0.5) de aire a cada lado. */
async function desdeIsotipo(size, margen) {
  const lado = Math.round(size * (1 - 2 * margen));
  const logo = await sharp(from).resize({ width: lado, height: lado, fit: "inside" }).toBuffer();
  const m = await sharp(logo).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: FONDO } })
    .composite([{ input: logo, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png();
}

const tareas = [
  { file: "icon-192.png", size: 192, padding: 40, margen: 0.14 },
  { file: "icon-512.png", size: 512, padding: 40, margen: 0.14 },
  // Maskable: Android recorta en círculo, el logo tiene que quedar dentro del 80 % central.
  { file: "icon-maskable-512.png", size: 512, padding: 96, margen: 0.22 },
  { file: "apple-touch-icon.png", size: 180, padding: 40, margen: 0.14 },
];

for (const t of tareas) {
  const img = from ? await desdeIsotipo(t.size, t.margen) : sharp(Buffer.from(svg(t))).png();
  await img.toFile(out(t.file));
  console.log("✓", t.file);
}

if (from) {
  // Favicon de la web (Next.js lo toma solo de app/icon.png).
  await (await desdeIsotipo(64, 0.06)).toFile(path.join(root, "app", "icon.png"));
  console.log("✓ app/icon.png");
}
