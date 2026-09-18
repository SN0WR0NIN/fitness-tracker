"use client";
import ProofGallery from "@/components/ProofGallery";
import { useMemo } from "react";

export default function ActivityProof({
  proofUrl,
  proofUrls,
  label,
  compact = false,
  variant = "grid",
}: {
  proofUrl?: string | null;
  proofUrls?: string[] | null;
  label: string;
  compact?: boolean;
  variant?: "grid" | "cover" | "full";
}) {
  const proofs = useMemo(() => {
    const values = proofUrls?.length ? proofUrls : proofUrl ? [proofUrl] : [];
    return [...new Set(values.filter(Boolean))].slice(0, 5);
  }, [proofUrl, proofUrls]);
  if (!proofs.length)
    return (
      <p className="text-xs text-slate-500 lg:col-span-4">
        No screenshot attached.
      </p>
    );
  return (
    <ProofGallery
      proofs={proofs}
      label={label}
      compact={compact}
      variant={variant}
      className="lg:col-span-4"
    />
  );
}
