"use client";

import Image from "next/image";
import { useRef, useState } from "react";

interface ImageUploadFieldProps {
  label: string;
  kind: "logo" | "flyer";
  eventoId: string;
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  previewClassName?: string;
}

export function ImageUploadField({
  label,
  kind,
  eventoId,
  value,
  onChange,
  onError,
  previewClassName,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("eventoId", eventoId);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        onError?.(data.error ?? "Error al subir");
        return;
      }
      onChange(data.url);
    } catch {
      onError?.("Error de red al subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-white/60">{label}</label>
      {value && (
        <div
          className={`relative mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/40 ${
            previewClassName ?? "h-32 w-full"
          }`}
        >
          <Image
            src={value}
            alt={label}
            fill
            className={kind === "logo" ? "object-contain p-2" : "object-cover"}
            unoptimized
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15 disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "Subir imagen"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-white/40">JPG, PNG o WebP — máx. 5 MB</p>
    </div>
  );
}
