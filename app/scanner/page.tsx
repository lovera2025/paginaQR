import { PinGate } from "@/components/auth/PinGate";
import { QRScanner } from "@/components/scanner/QRScanner";

export const metadata = {
  title: "Scanner — JR Eventos",
};

export default function ScannerPage() {
  return (
    <PinGate role="scanner" title="Scanner de entradas">
      <QRScanner />
    </PinGate>
  );
}
