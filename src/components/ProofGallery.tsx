"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { proofDisplayHref } from "@/lib/proof-reference";

type ProofGalleryProps = {
  proofs: string[];
  label: string;
  compact?: boolean;
  actionVerb?: "Enlarge" | "View";
  className?: string;
  variant?: "grid" | "cover";
};

export default function ProofGallery({
  proofs: rawProofs,
  label,
  compact = false,
  actionVerb = "Enlarge",
  className = "",
  variant = "grid",
}: ProofGalleryProps) {
  const proofs = useMemo(
    () => [...new Set(rawProofs.filter(Boolean))].slice(0, 5),
    [rawProofs],
  );
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [open, setOpen] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const move = useCallback(
    (direction: -1 | 1) => {
      setOpen((current) =>
        current === null
          ? current
          : (current + direction + proofs.length) % proofs.length,
      );
    },
    [proofs.length],
  );

  useEffect(() => {
    if (open === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowLeft" && proofs.length > 1) move(-1);
      if (event.key === "ArrowRight" && proofs.length > 1) move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [move, open, proofs.length]);

  if (!proofs.length) return null;
  const selected = open === null ? null : proofs[open];
  const grid =
    proofs.length === 1
      ? "max-w-sm grid-cols-1"
      : proofs.length === 2
        ? "max-w-2xl grid-cols-2"
        : "max-w-3xl grid-cols-2 sm:grid-cols-3";

  const thumbnails = variant === "cover" ? (
    <button
      type="button"
      onClick={() => setOpen(0)}
      className="group relative flex h-36 w-full items-center justify-center overflow-hidden bg-slate-900 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-300"
      aria-label={`${actionVerb} ${label} 1`}
    >
      {failed.has(0) ? (
        <p className="grid h-full w-full place-items-center p-4 text-center text-xs text-slate-400">
          Workout photo unavailable in this session.
        </p>
      ) : (
        <Image
          src={proofDisplayHref(proofs[0])!}
          alt={`${label} 1`}
          fill
          unoptimized
          referrerPolicy="no-referrer"
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
          onError={() => setFailed((current) => new Set(current).add(0))}
        />
      )}
      {proofs.length > 1 ? (
        <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
          {proofs.length} photos
        </span>
      ) : null}
    </button>
  ) : (
    <div className={`grid gap-2 ${grid}`}>
      {proofs.map((proof, index) => {
        const preview = proofDisplayHref(proof)!;
        return (
          <button
            key={proof}
            type="button"
            onClick={() => setOpen(index)}
            className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left transition hover:border-orange-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            aria-label={`${actionVerb} ${label} ${index + 1}`}
          >
            {failed.has(index) ? (
              <p className="grid min-h-24 place-items-center p-4 text-center text-xs text-slate-400">
                Proof unavailable in this session.
              </p>
            ) : (
              <div
                className={`relative ${compact ? "h-24 sm:h-32" : "h-40 sm:h-48"}`}
              >
                <Image
                  src={preview}
                  alt={`${label} ${index + 1}`}
                  fill
                  unoptimized
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  sizes="(max-width: 640px) 46vw, 240px"
                  className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  onError={() =>
                    setFailed((current) => new Set(current).add(index))
                  }
                />
              </div>
            )}
            <p className="border-t border-white/10 px-3 py-1.5 text-xs font-semibold text-orange-300">
              {index + 1} / {proofs.length} · Tap to enlarge
            </p>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      {thumbnails}

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} preview`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative flex h-full w-full max-w-6xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <a
                href={proofDisplayHref(selected, true)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/80 px-3 text-sm font-bold text-orange-300 hover:bg-white/10 sm:px-4"
              >
                <ExternalLink className="h-4 w-4" />
                Open original
              </a>
              <span
                aria-live="polite"
                className="text-sm font-bold text-slate-300"
              >
                {open! + 1} / {proofs.length}
              </span>
              <button
                type="button"
                onClick={() => setOpen(null)}
                autoFocus
                aria-label="Close proof preview"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/80 text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-950"
              onTouchStart={(event) => {
                touchStartX.current = event.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const endX = event.changedTouches[0]?.clientX;
                if (touchStartX.current === null || endX === undefined) return;
                const distance = endX - touchStartX.current;
                touchStartX.current = null;
                if (proofs.length > 1 && Math.abs(distance) >= 45)
                  move(distance > 0 ? -1 : 1);
              }}
            >
              <Image
                src={proofDisplayHref(selected)!}
                alt={`${label} ${open! + 1}`}
                fill
                unoptimized
                referrerPolicy="no-referrer"
                sizes="100vw"
                className="object-contain"
              />
              {proofs.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    aria-label="Previous proof"
                    className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90 sm:left-4"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    aria-label="Next proof"
                    className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90 sm:right-4"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              ) : null}
            </div>
            {proofs.length > 1 ? (
              <p className="mt-2 text-center text-xs text-slate-500">
                Swipe on mobile or use the arrow keys.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
