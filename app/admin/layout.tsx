import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel — Junior Eventos",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JE Staff" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
