import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Scanner — Junior Eventos",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JE Staff" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050508",
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
