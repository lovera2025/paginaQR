import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateQrBuffer } from "@/lib/qr/generate";
import { getAppUrl } from "@/lib/config";
import type { Evento, Ticket } from "@/types";

/** Resend Node SDK expects camelCase — see parseAttachments in resend/dist */
export interface ResendInlineAttachment {
  path?: string;
  content?: string;
  filename: string;
  contentType?: string;
  contentId: string;
}

function absoluteAssetUrl(path: string, appUrl: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = appUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function guessContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const name = new URL(url).pathname.split("/").pop();
    if (name && name.includes(".")) return name;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function attachImageFromUrl(
  url: string,
  cid: string,
  fallbackFilename: string
): Promise<ResendInlineAttachment | null> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  return {
    path: url,
    filename: filenameFromUrl(url, fallbackFilename),
    contentType: guessContentType(url),
    contentId: cid,
  };
}

/** Logo de la marca: desde /public si está en el disco; si no (serverless), por URL pública. */
async function logoAttachment(appUrl: string): Promise<ResendInlineAttachment | null> {
  const rel = "/marca/logo-claro.png";
  try {
    const buf = await readFile(path.join(process.cwd(), "public", rel));
    return { content: buf.toString("base64"), filename: "junior-eventos.png", contentType: "image/png", contentId: "logo" };
  } catch {
    return attachImageFromUrl(absoluteAssetUrl(rel, appUrl), "logo", "junior-eventos.png");
  }
}

export async function buildEmailInlineAssets(
  evento: Evento,
  tickets: Ticket[]
): Promise<{
  attachments: ResendInlineAttachment[];
  flyerCid: string | null;
  logoCid: string | null;
  qrCids: string[];
}> {
  const appUrl = getAppUrl();
  const attachments: ResendInlineAttachment[] = [];
  const logo = await logoAttachment(appUrl);
  if (logo) attachments.push(logo);
  const flyerUrl = absoluteAssetUrl(evento.flyerUrl, appUrl);

  let flyerCid: string | null = null;
  if (flyerUrl) {
    flyerCid = "flyer";
    const flyer = await attachImageFromUrl(flyerUrl, flyerCid, "flyer.jpg");
    if (flyer) attachments.push(flyer);
    else flyerCid = null;
  }

  const qrCids: string[] = [];
  for (const ticket of tickets) {
    const cid = `qr-${ticket.numeroEntrada}`;
    qrCids.push(cid);
    const buffer = await generateQrBuffer(ticket.id);
    attachments.push({
      content: buffer.toString("base64"),
      filename: `entrada-${ticket.numeroEntrada}.png`,
      contentType: "image/png",
      contentId: cid,
    });
  }

  return { attachments, flyerCid, logoCid: logo ? "logo" : null, qrCids };
}
