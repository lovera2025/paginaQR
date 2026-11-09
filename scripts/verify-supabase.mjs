/**
 * Verifica que Supabase esté configurado y el schema aplicado.
 * Uso: npm run verify:supabase
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

async function probeTable(baseUrl, apiKey, table) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=0`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, message: `${res.status} ${body.slice(0, 120)}` };
  }
  return { ok: true };
}

const env = { ...process.env, ...loadEnvLocal() };
const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("\n🔍 PaginaQR — Verificación Supabase\n");

if (!url || !serviceKey) {
  console.log("❌ Faltan variables en .env.local:");
  if (!url) console.log("   - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)");
  if (!serviceKey) console.log("   - SUPABASE_SERVICE_ROLE_KEY");
  console.log("\n📋 Settings → Data API → copiar Project URL exacta\n");
  process.exit(1);
}

console.log(`📡 URL: ${url}`);

let ok = true;

try {
  const tables = [
    "eventos",
    "tipos_entrada",
    "ordenes",
    "tickets",
    "activity_log",
    "app_branding",
    "app_pins",
    "app_payments",
  ];
  for (const table of tables) {
    const result = await probeTable(url, serviceKey, table);
    if (!result.ok) {
      console.log(`❌ Tabla "${table}": ${result.message}`);
      ok = false;
    } else {
      console.log(`✅ Tabla "${table}" OK`);
    }
  }

  // Columnas nuevas (migración 2026_11_modo_prueba_proximamente_anulaciones.sql)
  const colRes = await fetch(`${url}/rest/v1/ordenes?select=modo_pago,monto_reembolsado&limit=0`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!colRes.ok) {
    console.log("❌ Falta correr supabase/migrations/2026_11_modo_prueba_proximamente_anulaciones.sql");
    ok = false;
  } else {
    console.log("✅ Migración de modo prueba / anulaciones aplicada");
  }

  const eventoRes = await fetch(`${url}/rest/v1/eventos?select=slug,estado&order=fecha`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const eventos = await eventoRes.json();
  if (!eventoRes.ok) {
    console.log(`❌ Fiestas: ${JSON.stringify(eventos).slice(0, 160)}`);
    ok = false;
  } else if (!Array.isArray(eventos) || eventos.length === 0) {
    console.log("⚠️  No hay fiestas cargadas (corré supabase/seeds/recepciones_2026.sql o creá una desde el admin)");
  } else {
    const porEstado = eventos.reduce((acc, e) => ({ ...acc, [e.estado]: (acc[e.estado] ?? 0) + 1 }), {});
    console.log(`✅ ${eventos.length} fiestas (${Object.entries(porEstado).map(([k, v]) => `${v} ${k}`).join(", ")})`);
  }

  // La clave pública NO tiene que poder leer PINs ni credenciales de pago.
  if (anonKey) {
    for (const t of ["app_pins", "app_payments", "ordenes", "tickets"]) {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const body = r.ok ? await r.json() : [];
      if (Array.isArray(body) && body.length > 0) {
        console.log(`❌ La clave pública puede leer "${t}". Activá RLS en esa tabla.`);
        ok = false;
      }
    }
    console.log("✅ La clave pública no lee PINs, pagos, compras ni entradas");
  }
} catch (err) {
  console.log(`❌ No se pudo conectar: ${err.message}`);
  if (err.cause?.code === "ENOTFOUND") {
    console.log("\n💡 La Project URL parece incorrecta.");
    console.log("   Supabase → Settings → Data API → copiá la URL exacta.\n");
  }
  process.exit(1);
}

if (!anonKey) {
  console.log("⚠️  Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (Realtime en admin)");
}

if (ok) {
  console.log("\n✅ Supabase listo. Corré: npm run dev\n");
} else {
  console.log("\n❌ Revisá docs/SUPABASE-SETUP.md\n");
  process.exit(1);
}
