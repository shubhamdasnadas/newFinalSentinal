import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../lib/auth";
import { BillingModel } from "../../models/OrgModels";

function getOrgSlug(user: any): string | null {
  return user.activeOrgSlug || user.orgSlug || null;
}

/** Transform DB invoice row → frontend shape */
function transformInvoice(inv: Record<string, any>) {
  return {
    id: inv.invoice_ref || inv.id,
    _id: inv.id,
    amount: Number(inv.amount),
    date: inv.date,
    status: inv.status,
    orgSlug: inv.org_slug,
    createdAt: inv.created_at,
  };
}

/** Transform DB billing row → frontend shape */
function transformBilling(b: Record<string, any>) {
  return {
    _id: b.id,
    plan: b.plan,
    amount: Number(b.amount),
    currency: b.currency,
    status: b.status,
    billingDate: b.billing_date ?? null,
    orgSlug: b.org_slug,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    invoices: (b.invoices || []).map((inv: any) => transformInvoice(inv)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    let billing = await BillingModel.findByOrg(orgSlug);

    // Create default billing record if none exists
    if (!billing) {
      await BillingModel.upsert({ org_slug: orgSlug, plan: "free", amount: 0, status: "active" });
      billing = await BillingModel.findByOrg(orgSlug);
    }

    return NextResponse.json({ billing: billing ? transformBilling(billing as any) : null });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = verifyToken(token);
    if (user.role !== "super_admin" && user.role !== "org_admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const orgSlug = getOrgSlug(user);
    if (!orgSlug) return NextResponse.json({ message: "No active organization" }, { status: 400 });

    const body = await req.json();
    const billing = await BillingModel.upsert({ org_slug: orgSlug, ...body });

    // Re-fetch with invoices
    const full = await BillingModel.findByOrg(orgSlug);
    return NextResponse.json({ success: true, billing: full ? transformBilling(full as any) : transformBilling(billing as any) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
