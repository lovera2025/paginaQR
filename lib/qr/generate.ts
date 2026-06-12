import QRCode from "qrcode";

export async function generateQrDataUrl(ticketId: string): Promise<string> {
  return QRCode.toDataURL(ticketId, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function generateQrBuffer(ticketId: string): Promise<Buffer> {
  return QRCode.toBuffer(ticketId, {
    width: 400,
    margin: 2,
    type: "png",
  });
}
