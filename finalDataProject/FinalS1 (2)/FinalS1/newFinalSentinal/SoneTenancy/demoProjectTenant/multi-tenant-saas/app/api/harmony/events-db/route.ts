/**
 * GET /api/harmony/events-db
 *
 * Returns all Checkpoint events stored in the org's database.
 * No external API call — pure DB read.
 *
 * Auth: JWT cookie
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { CheckpointEventModel } from "../../../models/OrgModels";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = user.activeOrgSlug || user.orgSlug;
    if (!orgSlug) return NextResponse.json({ error: "No active organization" }, { status: 400 });

    // Ensure table exists before querying (handles orgs provisioned before this feature)
    await CheckpointEventModel.ensureTable(orgSlug);

    const rows = await CheckpointEventModel.findAll(orgSlug);
    const lastSyncedAt = await CheckpointEventModel.lastSyncedAt(orgSlug);

    // Map DB rows → the same shape the frontend already expects
    const responseData = rows.map((r) => ({
      eventId:             r.event_id,
      customerId:          r.customer_id ?? "",
      type:                r.type ?? "",
      state:               r.state ?? "",
      severity:            r.severity ?? "",
      confidenceIndicator: r.confidence_indicator ?? "",
      description:         r.description ?? "",
      senderAddress:       r.sender_address ?? "",
      saas:                r.saas ?? "",
      entityId:            r.entity_id ?? "",
      entityLink:          r.entity_link ?? "",
      eventCreated:        r.event_created ? r.event_created.toISOString() : "",
      actions:             r.actions ?? [],
      additionalData:      r.additional_data ?? null,
    }));

    return NextResponse.json({
      responseData,
      totalInDb: rows.length,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
