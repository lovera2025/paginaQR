/**
 * Actualiza el evento demo con datos del flyer real.
 * Uso: node scripts/update-evento-demo.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Faltan credenciales Supabase en .env.local");
  process.exit(1);
}

const evento = {
  nombre: "Fiesta de Promo — Buzo Chomba Bandera",
  fecha: "2026-06-20T22:00:00.000Z",
  precio: 15000,
  capacidad: 300,
  activo: true,
  logo_url: "/flyer.jpeg",
  flyer_url: "/flyer.jpeg",
  color_primario: "#FFCC00",
  color_secundario: "#1a1a1a",
  descripcion:
    "Fiesta de promo con desfile, presentación y joda. Incluye buzo, chomba y bandera. ¡No te quedes afuera!",
  lugar: "A confirmar",
  maps_url: "",
  contacto_whatsapp: "",
  contacto_email: "",
  contacto_instagram: "",
  texto_footer: "Consultas por WhatsApp o redes. Política de reembolsos: contactá al organizador.",
  organizador_nombre: "Promo 2026",
};

const res = await fetch(`${url}/rest/v1/eventos?id=eq.evento-demo`, {
  method: "PATCH",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(evento),
});

const data = await res.json();
if (!res.ok) {
  console.error("❌ Error:", data);
  process.exit(1);
}

console.log("✅ Evento actualizado:", data[0]?.nombre);
console.log("   Flyer: /flyer.jpeg");
console.log("   Fecha: Sábado 20 de junio 2026");
