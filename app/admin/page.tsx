import { PinGate } from "@/components/auth/PinGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  return (
    <PinGate role="admin">
      <AdminDashboard />
    </PinGate>
  );
}
