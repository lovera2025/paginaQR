import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050508] px-6 text-center">
      <p className="mb-4 text-5xl">❌</p>
      <h1 className="mb-2 text-2xl font-bold">Pago no realizado</h1>
      <p className="mb-8 text-white/60">
        El pago fue rechazado o cancelado. Podés intentar de nuevo.
      </p>
      <Link
        href="/comprar"
        className="rounded-xl bg-white px-6 py-3 font-semibold text-black"
      >
        Reintentar compra
      </Link>
    </div>
  );
}
