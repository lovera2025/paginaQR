import Link from "next/link";

export default function FiestaNoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche px-6 text-center">
      <p className="font-script text-6xl text-oro">Ups</p>
      <h1 className="font-display text-2xl font-extrabold">No encontramos esa fiesta</h1>
      <p className="max-w-sm text-sm text-white/60">Puede que todavía no esté publicada o que el link esté mal.</p>
      <Link href="/" className="btn-oro mt-2 h-12 px-6 text-sm">
        Ver todas las fiestas
      </Link>
    </main>
  );
}
