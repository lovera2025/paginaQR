import { describe, expect, it } from "vitest";
import { buildTicketPdf } from "@/lib/pdf/ticket";
import { buildConfirmationHtml, buildConfirmationSubject } from "@/lib/email/template";
import { SEED_BRANDING } from "@/lib/mock/seed";
import { evento, orden, ticket } from "./helpers";

// Nombres que escribe la gente de verdad: emojis, letras de otros idiomas, comillas tipográficas, muy largos.
const NOMBRES = [
  "Juli 💃🏻 Pérez",
  "Łukasz Ñandú Gómez “el Tano”",
  "李小龍",
  "María José de los Ángeles Fernández de la Cruz Rodríguez Etchegaray",
  "<script>alert(1)</script>",
];

describe("PDF y mail con nombres raros", () => {
  it("el PDF se arma igual (no se rompe con caracteres que la fuente no tiene)", async () => {
    const tickets = NOMBRES.map((n, i) =>
      ticket({ id: `0000000${i}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, compradorNombre: n, numeroEntrada: i + 1, totalEntradas: NOMBRES.length })
    );
    const pdf = await buildTicketPdf({
      evento: evento({ nombre: "Colegio “Nuestra Señora” 🎓 — Recepción", flyerUrl: "/flyers/pinaroli.png", lugar: "Salón Ñ" }),
      orden: orden({ cantidad: NOMBRES.length, compradorNombre: NOMBRES[0] }),
      tickets,
      branding: SEED_BRANDING,
      origin: "http://127.0.0.1:9",
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("el mail escapa el nombre (no se puede inyectar HTML)", () => {
    const o = orden({ compradorNombre: NOMBRES[4] });
    const html = buildConfirmationHtml({
      orden: o,
      tickets: [ticket({ compradorNombre: NOMBRES[4] })],
      evento: evento(),
      branding: SEED_BRANDING,
      flyerCid: null,
      qrCids: ["qr0"],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(buildConfirmationSubject(evento(), o)).toContain("Fiesta de prueba");
  });
});
