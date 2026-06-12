import { PinGate } from "@/components/auth/PinGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata = {
  title: "Admin — PaginaQR",
};

export default function AdminPage() {
  return (
    <PinGate role="admin" title="Panel de administración">
      <AdminDashboard />
    </PinGate>
  );
}
