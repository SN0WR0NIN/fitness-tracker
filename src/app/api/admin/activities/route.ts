import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { getLatestScoreReviewNotes } from "@/lib/admin-control";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status, headers },
    );
  }

  const status = request.nextUrl.searchParams.get("status") || "PENDING";
  if (!["ALL", "PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { error: "Choose a valid activity status." },
      { status: 400, headers },
    );
  }

  try {
    const [activities, reviewNotes] = await Promise.all([
      prisma.activity.findMany({
        where:
          status === "ALL"
            ? {}
            : { status: status as "PENDING" | "APPROVED" | "REJECTED" },
        include: {
          pointsLog: {
            select: { basePoints: true, friendBonus: true, totalPoints: true },
          },
          user: { select: { id: true, name: true, email: true } },
          column: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      getLatestScoreReviewNotes(),
    ]);

    return NextResponse.json(
      activities.map((activity: (typeof activities)[number]) => ({
        ...activity,
        reviewNote: reviewNotes.get(activity.id) ?? "",
      })),
      { headers },
    );
  } catch (error) {
    console.error("Error fetching activities for review:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500, headers },
    );
  }
}
