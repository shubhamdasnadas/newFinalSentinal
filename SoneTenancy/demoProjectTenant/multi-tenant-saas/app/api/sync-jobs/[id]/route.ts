import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { getSyncJob } from "../../../lib/syncJobs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jwtToken = req.cookies.get("token")?.value;

    if (!jwtToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = verifyToken(jwtToken);

    const orgSlug = user.activeOrgSlug || user.orgSlug;

    if (!orgSlug) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing job id" },
        { status: 400 }
      );
    }

    const job = await getSyncJob(orgSlug, id);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error("GET /api/sync-jobs/[id] error:", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}