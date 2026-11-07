import { PinGate } from "@/components/auth/PinGate";
import { QRScanner } from "@/components/scanner/QRScanner";

export default function ScannerPage() {
  return (
    <PinGate role="scanner">
      <QRScanner />
    </PinGate>
  );
}
