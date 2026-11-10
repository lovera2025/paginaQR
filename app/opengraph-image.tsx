import { ImageResponse } from "next/og";
import { getCatalogo } from "@/lib/db";
import { fuentesOg, fuenteTitulos, imagenDataUrl, OG_SIZE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Junior Eventos — Recepciones Promo 2026";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

const ORO = "#d4a853";

/** Imagen que se ve al compartir la página principal: tres flyers en abanico + la marca. */
export default async function Image() {
  let flyersSrc: string[] = [];
  try {
    flyersSrc = (await getCatalogo())
      .map((c) => c.evento.flyerUrl)
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    /* sin base: imagen solo con la marca */
  }
  const [isotipo, righteous, ...flyers] = await Promise.all([
    imagenDataUrl("/marca/isotipo-claro.png"),
    fuenteTitulos(),
    ...flyersSrc.map((f) => imagenDataUrl(f)),
  ]);
  const titulos = righteous ? "Righteous" : "sans-serif";
  const fan = flyers.filter((f): f is string => Boolean(f));
  const pos = [
    { left: 150, top: 40, rot: 0, w: 260 },
    { left: 20, top: 90, rot: -10, w: 220 },
    { left: 300, top: 90, rot: 10, w: 220 },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#050508",
          backgroundImage: "radial-gradient(circle at 30% 0%, rgba(212,168,83,0.3), rgba(5,5,8,0) 60%)",
          color: "#ffffff",
          padding: "0 0 0 70px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 560, gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isotipo && <img src={isotipo} alt="" width={60} height={63} />}
            <span style={{ fontSize: 28, letterSpacing: 6, color: ORO, fontFamily: titulos }}>JUNIOR EVENTOS</span>
          </div>
          <span style={{ fontSize: 88, lineHeight: 1, fontFamily: titulos }}>Recepciones</span>
          <span style={{ fontSize: 88, lineHeight: 1, fontFamily: titulos, color: ORO }}>Promo 2026</span>
          <span style={{ fontSize: 30, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
            Elegí tu fiesta. Tu entrada con QR al instante.
          </span>
        </div>
        <div style={{ display: "flex", position: "relative", flex: 1 }}>
          {/* Se dibujan en orden (no hay z-index): primero los de los costados, el del centro arriba. */}
          {[1, 2, 0].filter((i) => i < fan.length).map((i) => {
            const src = fan[i];
            const p = pos[fan.length === 1 ? 0 : i];
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                width={p.w}
                height={Math.round((p.w * 16) / 9)}
                style={{
                  position: "absolute",
                  left: p.left,
                  top: p.top,
                  transform: `rotate(${p.rot}deg)`,
                  borderRadius: 22,
                  border: i === 0 ? `3px solid ${ORO}` : "2px solid rgba(255,255,255,0.15)",
                  objectFit: "cover",
                }}
              />
            );
          })}
        </div>
      </div>
    ),
    { ...size, fonts: fuentesOg(righteous) }
  );
}
