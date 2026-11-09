// Prepara los archivos de marca de Junior Eventos en /public/marca a partir de los originales.
// Uso: node scripts/preparar-marca.mjs "C:\Users\...\Desktop\plan\icons"
// Requiere la devDependency "sharp". Después: node scripts/make-icons.mjs --from public/marca/isotipo-claro.png
import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = process.argv[2];
if (!origen) {
  console.error("Falta la carpeta de originales. Ej: node scripts/preparar-marca.mjs ./imagen/marca/originales");
  process.exit(1);
}

const destino = path.join(root, "public", "marca");
const copia = path.join(root, "imagen", "marca");
await mkdir(destino, { recursive: true });
await mkdir(copia, { recursive: true });
const src = (f) => path.join(origen, f);
const out = (f) => path.join(destino, f);

// Isotipo blanco + "j" magenta (fondo transparente): header, footer, staff, íconos de la app.
const iso = await sharp(src("2.png")).trim().resize({ height: 512, fit: "inside" }).png().toBuffer();
await sharp(iso).toFile(out("isotipo-claro.png"));

// Nombre "JUNIOR EVENTOS" en blanco macizo: se toma la forma (alfa) del nombre gris relleno y se pinta de blanco.
const nombreGris = await sharp(src("nombre1.png")).trim().resize({ width: 900, fit: "inside" }).ensureAlpha().toBuffer();
const nombreMetaBase = await sharp(nombreGris).metadata();
const alfa = await sharp(nombreGris).extractChannel("alpha").toBuffer();
const nombre = await sharp({
  create: { width: nombreMetaBase.width, height: nombreMetaBase.height, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .joinChannel(alfa)
  .png()
  .toBuffer();
await sharp(nombre).toFile(out("nombre-claro.png"));

// Logo horizontal (isotipo + nombre) para el mail y el PDF, que tienen fondo oscuro.
const isoAlto = 200;
const isoChico = await sharp(iso).resize({ height: isoAlto }).toBuffer();
const isoMeta = await sharp(isoChico).metadata();
const nombreChico = await sharp(nombre).resize({ height: 64 }).toBuffer();
const nombreMeta = await sharp(nombreChico).metadata();
const gap = 36;
const ancho = isoMeta.width + gap + nombreMeta.width;
await sharp({ create: { width: ancho, height: isoAlto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: isoChico, left: 0, top: 0 },
    { input: nombreChico, left: isoMeta.width + gap, top: Math.round((isoAlto - nombreMeta.height) / 2) },
  ])
  .png()
  .toFile(out("logo-claro.png"));

for (const f of ["isotipo-claro.png", "nombre-claro.png", "logo-claro.png"]) {
  await copyFile(out(f), path.join(copia, f));
  const m = await sharp(out(f)).metadata();
  console.log(`✓ public/marca/${f} (${m.width}×${m.height})`);
}
