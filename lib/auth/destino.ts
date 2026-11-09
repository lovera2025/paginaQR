export type RolStaff = "admin" | "scanner";

/**
 * A dónde se puede volver después del login (?next=). Solo rutas internas del staff:
 * evita redirecciones a otros sitios ("//evil.com", "/\evil.com", "https://…").
 */
export function destinoPermitido(next: string | null, rol: RolStaff): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?")) return rol === "admin" ? next : null;
  if (next === "/scanner" || next.startsWith("/scanner/") || next.startsWith("/scanner?")) return next;
  return null;
}
