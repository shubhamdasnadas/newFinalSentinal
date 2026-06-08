/**
 * GET /api/zoho/tickets-db
 *
 * Returns all Zoho tickets stored in zohotable.
 * No external API call — pure DB read.
 *
 * Auth: JWT cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

type ZohoStoredTickets = {
  data?: unknown[];
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = verifyToken(token);

    const orgSlug = user.activeOrgSlug || user.orgSlug;

    if (!orgSlug) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    await orgQuery(
      orgSlug,
      `CREATE TABLE IF NOT EXISTS zohotable (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        data_name  TEXT        NOT NULL UNIQUE,
        data       JSONB       NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    const rows = await orgQuery<{
      data: ZohoStoredTickets | unknown[];
      updated_at: Date | string | null;
    }>(
      orgSlug,
      "SELECT data, updated_at FROM zohotable WHERE data_name = $1 LIMIT 1",
      ["ticket_data"]
    );

    const storedData = rows[0]?.data;
    const responseData = Array.isArray(storedData)
      ? storedData
      : storedData?.data ?? [];

    return NextResponse.json({
      responseData,
      totalInDb: responseData.length,
      lastSyncedAt: rows[0]?.updated_at ?? null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
