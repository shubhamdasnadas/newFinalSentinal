import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";
import { orgQuery } from "../../../lib/db";

function getOrgSlug(user: any): string | null {
    return user.activeOrgSlug || user.orgSlug || null;
}

async function ensureTable(orgSlug: string) {
    await orgQuery(
        orgSlug,
        `CREATE TABLE IF NOT EXISTS firewall_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name TEXT NOT NULL,
    x_axis TEXT,
    y_axis TEXT,
    chart_type TEXT DEFAULT 'bar',
    x INT NOT NULL DEFAULT 0,
    y INT NOT NULL DEFAULT 0,
    w INT NOT NULL DEFAULT 5,
    h INT NOT NULL DEFAULT 6,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
    );

    await orgQuery(orgSlug, `ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS x_axis TEXT`);
    await orgQuery(orgSlug, `ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS y_axis TEXT`);
    await orgQuery(orgSlug, `ALTER TABLE firewall_widgets ADD COLUMN IF NOT EXISTS chart_type TEXT DEFAULT 'bar'`);
}

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const user = verifyToken(token);
        const orgSlug = getOrgSlug(user);
        if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

        await ensureTable(orgSlug);

        const rows = await orgQuery(
            orgSlug,
            `SELECT id, report_name, x_axis, y_axis, chart_type, x, y, w, h, created_at
FROM firewall_widgets
ORDER BY created_at ASC`
        );

        return NextResponse.json({ widgets: rows });
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;

        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const user = verifyToken(token);
        const orgSlug = getOrgSlug(user);

        if (!orgSlug) {
            return NextResponse.json(
                { message: "No active organization" },
                { status: 400 }
            );
        }

        const body = await req.json();

        const reportName = body.reportName;
        const xAxis = Array.isArray(body.xAxis) ? body.xAxis : [body.xAxis];
        const yAxis = Array.isArray(body.yAxis) ? body.yAxis : [body.yAxis];
        const chartType = body.chartType || "mixed";

        if (!reportName) {
            return NextResponse.json(
                { message: "reportName required" },
                { status: 400 }
            );
        }

        if (!xAxis || !yAxis) {
            return NextResponse.json(
                { message: "xAxis and yAxis required" },
                { status: 400 }
            );
        }

        await ensureTable(orgSlug);

        const maxRows = await orgQuery<{ max_y: number }>(
            orgSlug,
            `
      SELECT COALESCE(MAX(y + h), 0) AS max_y
      FROM (
        SELECT x, y, w, h FROM firewall_widgets

        UNION ALL SELECT 0, 0, 5, 7
        UNION ALL SELECT 5, 0, 4, 7
        UNION ALL SELECT 9, 0, 3, 7
        UNION ALL SELECT 0, 7, 7, 8
        UNION ALL SELECT 7, 7, 5, 8
        UNION ALL SELECT 0, 15, 5, 7
      ) all_widgets
      `
        );

        const nextY = Number(maxRows[0]?.max_y ?? 0) + 1;

        const rows = await orgQuery(
            orgSlug,
            `
      INSERT INTO firewall_widgets 
        (report_name, x_axis, y_axis, chart_type, x, y, w, h)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id, report_name, x_axis, y_axis, chart_type, x, y, w, h, created_at
      `,
            [
                reportName,
                JSON.stringify(xAxis),
                JSON.stringify(yAxis),
                chartType,
                0,
                nextY,
                6,
                6,
            ]
        );

        return NextResponse.json({ widget: rows[0] });
    } catch (error: any) {
        console.error("[FW] add widget error:", error.message);

        return NextResponse.json(
            { message: error.message },
            { status: 500 }
        );
    }
}