import { readFile } from "fs/promises";
import path from "path";

/** Medidas de la imagen para compartir (WhatsApp, Instagram, Facebook). */
export const OG_SIZE = { width: 1200, height: 630 };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Lee una imagen (de /public o de una URL, ej. Supabase Storage) y la devuelve como data URL
 * para dibujarla en la imagen para compartir. Si no se puede, devuelve null y la imagen sale sin ella.
 */
export async function imagenDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    if (src.startsWith("/")) {
      const limpio = path.normalize(src).replace(/^([/\\])+/, "");
      if (limpio.startsWith("..")) return null;
      const archivo = path.join(process.cwd(), "public", limpio);
      const buf = await readFile(archivo);
      const mime = MIME[path.extname(archivo).toLowerCase()] ?? "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
    if (/^https:\/\//.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const mime = res.headers.get("content-type") ?? "image/png";
      if (!mime.startsWith("image/")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch {
    /* sin imagen */
  }
  return null;
}

let fuenteCache: Promise<ArrayBuffer | null> | null = null;

/** Righteous (la letra de los títulos). Si no se puede bajar, la imagen usa la letra por defecto. */
export function fuenteTitulos(): Promise<ArrayBuffer | null> {
  if (!fuenteCache) {
    fuenteCache = (async () => {
      try {
        const css = await fetch("https://fonts.googleapis.com/css2?family=Righteous", {
          signal: AbortSignal.timeout(4000),
        }).then((r) => r.text());
        const url = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
        if (!url) return null;
        return await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer());
      } catch {
        return null;
      }
    })().then((f) => {
      if (!f) fuenteCache = null; // reintenta la próxima vez
      return f;
    });
  }
  return fuenteCache;
}

export function fuentesOg(righteous: ArrayBuffer | null) {
  return righteous ? [{ name: "Righteous", data: righteous, weight: 400 as const, style: "normal" as const }] : [];
}
