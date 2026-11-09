import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche px-6 text-center">
      <p className="font-script text-6xl text-oro">Ups</p>
      <h1 className="font-display text-2xl font-extrabold">Esta página no existe</h1>
      <p className="max-w-sm text-sm text-white/70">Puede que el link esté mal escrito o que la página ya no esté.</p>
      <Link href="/" className="btn-oro mt-2 h-12 px-6 text-sm">
        Ver las fiestas
      </Link>
    </main>
  );
}
