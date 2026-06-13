import { createServerClient } from "./server";

const BUCKET = "eventos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadEventoImage(
  eventoId: string,
  kind: "logo" | "flyer",
  file: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string } | { error: string }> {
  const client = createServerClient();
  if (!client) return { error: "Supabase no configurado" };

  if (!ALLOWED_TYPES.has(contentType)) {
    return { error: "Formato no permitido. Usá JPG, PNG o WebP." };
  }
  if (file.byteLength > MAX_BYTES) {
    return { error: "La imagen supera 5 MB" };
  }

  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const path = `${eventoId}/${kind}-${Date.now()}.${safeExt}`;

  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });

  if (error) return { error: error.message };

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
