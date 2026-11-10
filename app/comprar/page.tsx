import { redirect } from "next/navigation";

/** Compatibilidad con links viejos: ahora se compra desde cada fiesta. */
export default function ComprarPage() {
  redirect("/#fiestas");
}
