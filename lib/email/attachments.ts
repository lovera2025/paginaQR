import { generateQrBuffer } from "@/lib/qr/generate";
import { getAppUrl } from "@/lib/config";
import type { Evento, Ticket } from "@/types";

export interface ResendAttachment {
  content: Buffer;
  filename: string;
  content_type: string;
  content_id: string;
}

function absoluteAssetUrl(path: string, appUrl: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = appUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function guessContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

async function attachImageFromUrl(
  url: string,
  cid: string,
  filename: string
): Promise<ResendAttachment | null> {
  const buffer = await fetchImageBuffer(url);
  if (!buffer || buffer.length === 0) return null;
  return {
    content: buffer,
    filename,
    content_type: guessContentType(url),
    content_id: cid,
  };
}

export async function buildEmailInlineAssets(
  evento: Evento,
  tickets: Ticket[]
): Promise<{
  attachments: ResendAttachment[];
  flyerCid: string | null;
  logoCid: string | null;
  qrCids: string[];
}> {
  const appUrl = getAppUrl();
  const attachments: ResendAttachment[] = [];
  const flyerUrl = absoluteAssetUrl(evento.flyerUrl, appUrl);
  const logoUrl = absoluteAssetUrl(evento.logoUrl, appUrl);

  let flyerCid: string | null = null;
  if (flyerUrl) {
    flyerCid = "flyer";
    const flyer = await attachImageFromUrl(flyerUrl, flyerCid, "flyer.jpg");
    if (flyer) attachments.push(flyer);
    else flyerCid = null;
  }

  let logoCid: string | null = null;
  if (logoUrl && logoUrl !== flyerUrl) {
    logoCid = "logo";
    const logo = await attachImageFromUrl(logoUrl, logoCid, "logo.jpg");
    if (logo) attachments.push(logo);
    else logoCid = null;
  }

  const qrCids: string[] = [];
  for (const ticket of tickets) {
    const cid = `qr-${ticket.numeroEntrada}`;
    qrCids.push(cid);
    attachments.push({
      content: await generateQrBuffer(ticket.id),
      filename: `entrada-${ticket.numeroEntrada}.png`,
      content_type: "image/png",
      content_id: cid,
    });
  }

  return { attachments, flyerCid, logoCid, qrCids };
}
