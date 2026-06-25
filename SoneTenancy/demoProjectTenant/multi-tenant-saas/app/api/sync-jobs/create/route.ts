import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { createSyncJob, SyncSource } from "../../../lib/syncJobs";
import { query } from "../../../lib/db";

export async function POST(req: NextRequest) {
  try {
    const jwtToken = req.cookies.get("token")?.value;
    if (!jwtToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = verifyToken(jwtToken);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { source, extra } = body as { source?: SyncSource; extra?: any };

    const allowed: SyncSource[] = [
      "sentinelone",
      "harmony",
      "crowdstrike",
      "defender",
      "firewall",
    ];

    if (!source || !allowed.includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const jobId = await createSyncJob(orgSlug, source, extra);
    if (!jobId) return NextResponse.json({ error: "Failed to create job" }, { status: 500 });

    return NextResponse.json({ jobId, source, orgSlug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

