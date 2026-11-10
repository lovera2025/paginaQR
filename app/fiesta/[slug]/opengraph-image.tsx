import { ImageResponse } from "next/og";
import { getEventoBySlug } from "@/lib/db";
import { formatFecha } from "@/lib/utils";
import { fuentesOg, fuenteTitulos, imagenDataUrl, OG_SIZE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Entradas para la recepción";
export const size = OG_SIZE;
export const contentType = "image/png";

const ORO = "#d4a853";
const ORO_CLARO = "#f0d389";

/** Imagen que se ve al compartir el link de una fiesta: flyer + nombre, fecha y lugar. */
export default async function Image({ params }: { params: { slug: string } }) {
  const ev = await getEventoBySlug(params.slug);
  // Las fiestas en borrador no se muestran: sale la imagen genérica de la marca.
  const evento = ev && (ev.estado === "venta" || ev.estado === "pausado") ? ev : null;
  const [flyer, isotipo, righteous] = await Promise.all([
    evento ? imagenDataUrl(evento.flyerUrl) : Promise.resolve(null),
    imagenDataUrl("/marca/isotipo-claro.png"),
    fuenteTitulos(),
  ]);
  const titulos = righteous ? "Righteous" : "sans-serif";
  const nombre = evento?.nombre ?? "Recepciones Promo 2026";
  const largo = nombre.length > 42;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#050508",
          backgroundImage: "radial-gradient(circle at 75% 0%, rgba(212,168,83,0.28), rgba(5,5,8,0) 60%)",
          color: "#ffffff",
          padding: "34px 60px 34px 56px",
          gap: 54,
          alignItems: "center",
        }}
      >
        {flyer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flyer}
            alt=""
            width={316}
            height={562}
            style={{ borderRadius: 26, border: `3px solid ${ORO}`, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 316,
              height: 562,
              borderRadius: 26,
              border: `3px solid ${ORO}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              color: ORO,
              fontFamily: titulos,
            }}
          >
            Promo 2026
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isotipo && <img src={isotipo} alt="" width={54} height={57} />}
            <span style={{ fontSize: 26, letterSpacing: 6, color: ORO, fontFamily: titulos }}>JUNIOR EVENTOS</span>
          </div>
          <span style={{ fontSize: 22, letterSpacing: 4, color: "rgba(255,255,255,0.65)" }}>
            {(evento?.subtitulo || "RECEPCIÓN · PROMO 2026").toUpperCase()}
          </span>
          <span style={{ fontSize: largo ? 52 : 64, lineHeight: 1.05, fontFamily: titulos }}>{nombre}</span>
          {evento && (
            <span style={{ fontSize: 32, color: ORO_CLARO, marginTop: 6 }}>{formatFecha(evento.fecha)}</span>
          )}
          {evento?.lugar && <span style={{ fontSize: 28, color: "rgba(255,255,255,0.8)" }}>{evento.lugar}</span>}
          <div style={{ display: "flex", marginTop: 14 }}>
            <span
              style={{
                fontSize: 28,
                padding: "14px 30px",
                borderRadius: 999,
                backgroundColor: ORO,
                color: "#140f02",
                fontFamily: titulos,
              }}
            >
              Entradas online con QR
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fuentesOg(righteous) }
  );
}
