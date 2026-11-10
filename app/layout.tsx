import type { Metadata, Viewport } from "next";
import { Great_Vibes, Inter, Righteous } from "next/font/google";
import "./globals.css";
import { getAppUrl } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Righteous: geométrica y redondeada, la más parecida a las letras del logo de Junior Eventos. Tiene un solo peso.
const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  // Necesario para que las imágenes para compartir salgan con la URL completa del sitio.
  metadataBase: new URL(getAppUrl()),
  title: "Junior Eventos — Recepciones Promo 2026",
  description:
    "Entradas para las recepciones de egresados Promo 2026. Elegí tu fiesta, pagá online y recibí tu entrada con QR al instante.",
  openGraph: {
    title: "Junior Eventos — Recepciones Promo 2026",
    description: "Elegí tu fiesta, pagá online y recibí tu entrada con QR al instante.",
    type: "website",
    locale: "es_AR",
  },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${righteous.variable} ${greatVibes.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
