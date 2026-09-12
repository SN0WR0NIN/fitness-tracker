import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdmin } from "@/lib/adminGuard";
import { recordAdminAudit } from "@/lib/admin-control";
import { prisma } from "@/lib/prisma";
import { deleteProofImages } from "@/lib/storage";

const headers = { "Cache-Control": "private, no-store" };
const storagePath = z
  .string()
  .min(3)
  .max(512)
  .refine(
    (value) =>
      value.includes("/") &&
      value
        .split("/")
        .every(
          (part) =>
            /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..",
        ),
    "Invalid proof object path",
  );
const DeleteSchema = z
  .object({
    confirm: z.literal("DELETE_UNATTACHED_PROOFS"),
    paths: z.array(storagePath).min(1).max(20),
  })
  .refine((value) => new Set(value.paths).size === value.paths.length, {
    message: "Duplicate object path",
    path: ["paths"],
  });

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (guard.error)
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status, headers },
    );
  try {
    const { paths } = DeleteSchema.parse(await request.json());
    for (const path of paths) {
      const rows = await prisma.$queryRaw<Array<{ attached: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM "Activity" a
          WHERE a."proofUrl" LIKE '%' || ${path}
             OR EXISTS (SELECT 1 FROM unnest(a."proofUrls") proof WHERE proof LIKE '%' || ${path})
          UNION ALL
          SELECT 1 FROM app_internal.activity_correction c
          WHERE c.original::text LIKE '%' || ${path} || '%'
             OR c.proposed::text LIKE '%' || ${path} || '%'
             OR COALESCE(c.applied::text, '') LIKE '%' || ${path} || '%'
        ) AS attached
      `;
      if (rows[0]?.attached)
        return NextResponse.json(
          { error: "A requested proof is attached and was not deleted." },
          { status: 409, headers },
        );
    }
    await deleteProofImages(paths);
    for (const path of paths) {
      const remaining = await prisma.$queryRaw<
        Array<{ exists: boolean }>
      >`SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='activity-proofs' AND name=${path}) AS exists`;
      if (remaining[0]?.exists)
        throw new Error("Storage API reported success but an object remains.");
    }
    await recordAdminAudit(
      guard.userId,
      "Deleted unattached proof objects",
      "activity-proofs",
      { count: paths.length },
    );
    return NextResponse.json({ deleted: paths.length }, { headers });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid cleanup request" },
        { status: 400, headers },
      );
    console.error(
      "Unattached proof cleanup failed:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Unattached proofs could not be deleted." },
      { status: 500, headers },
    );
  }
}
