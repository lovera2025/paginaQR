import { getMpSettings } from "@/lib/mercadopago/credentials";

const MP_API = "https://api.mercadopago.com";

export async function getMpAccessToken(): Promise<string | null> {
  const mp = await getMpSettings();
  return mp.accessToken.trim() || null;
}

export async function mpFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T } | { error: string; status: number }> {
  const token = await getMpAccessToken();
  if (!token) return { error: "Mercado Pago no configurado", status: 500 };

  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[MP] ${path} ${res.status}:`, text);
    return { error: "Error al comunicarse con Mercado Pago", status: res.status };
  }

  const data = (await res.json()) as T;
  return { data };
}
