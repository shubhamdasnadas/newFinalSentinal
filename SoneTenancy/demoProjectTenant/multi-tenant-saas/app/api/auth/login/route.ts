import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "../../../lib/auth";
import { UserModel } from "../../../models/User";
import { OrgModel, ALL_PAGES } from "../../../models/Organization";
import { OrgUserModel } from "../../../models/OrgModels";

function setCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: "token",
    value: token,
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: false,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email?.trim()) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }
    if (!password?.trim()) {
      return NextResponse.json({ message: "Password is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // ── STEP 1: Try super admin / main users table ────────────────────────────
    const adminUser = await UserModel.findByEmail(cleanEmail);

    if (adminUser) {
      const isMatch = await bcrypt.compare(password, adminUser.password);
      if (!isMatch) {
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
      }
      if (!adminUser.is_active) {
        return NextResponse.json({ message: "Account is deactivated." }, { status: 403 });
      }

      const token = signToken({
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      });

      const response = NextResponse.json({ success: true, role: adminUser.role });
      setCookie(response, token);
      return response;
    }

    // ── STEP 2: Try org users — search each active org's own database ─────────
    // Collect ALL orgs where this email exists, then find the one whose
    // password hash matches. This handles the same email in multiple orgs.
    const activeOrgs = await OrgModel.findActive();
    const activeSlugs = activeOrgs.map((o) => o.slug);

    const candidates = await OrgUserModel.findAllByEmailAcrossOrgs(cleanEmail, activeSlugs);

    if (candidates.length > 0) {
      // Find ALL candidates whose password matches (same email, different orgs)
      const matchedMembers: (typeof candidates) = [];
      for (const candidate of candidates) {
        if (!candidate.is_active) continue;
        if (candidate.password) {
          const isMatch = await bcrypt.compare(password, candidate.password);
          if (isMatch) matchedMembers.push(candidate);
        } else {
          matchedMembers.push(candidate);
        }
      }

      if (matchedMembers.length === 0) {
        const anyDeactivated = candidates.some((c) => !c.is_active);
        if (anyDeactivated && candidates.length === 1) {
          return NextResponse.json({ message: "Your account has been deactivated." }, { status: 403 });
        }
        return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
      }

      // Resolve org records for all matched members (needed for both paths below)
      const matchedOrgs = await Promise.all(
        matchedMembers.map((m) => OrgModel.findBySlug(m.org_slug))
      );
      const validOrgs = matchedOrgs.filter(Boolean) as NonNullable<(typeof matchedOrgs)[0]>[];
      const memberOrgIds = validOrgs.map((o) => o.id);

      // Multiple orgs matched — issue a pending token and let the user choose
      if (matchedMembers.length > 1) {
        const pendingToken = signToken({
          userId: matchedMembers[0].id,
          email: matchedMembers[0].email,
          name: matchedMembers[0].name,
          role: matchedMembers[0].role,
          pendingOrgIds: memberOrgIds,
          memberOrgIds,
        });

        const response = NextResponse.json({
          pendingOrgs: validOrgs.map((o) => ({
            _id: o.id,
            name: o.name,
            color: o.color,
            plan: o.plan,
          })),
        });
        response.cookies.set({
          name: "token",
          value: pendingToken,
          httpOnly: true,
          path: "/",
          maxAge: 60 * 5, // 5 minutes — just enough to complete org selection
          sameSite: "lax",
          secure: false,
        });
        return response;
      }

      // Single match — log straight in
      const matchedMember = matchedMembers[0];
      const org = validOrgs[0];
      if (!org) {
        return NextResponse.json({ message: "Organization not found." }, { status: 404 });
      }

      const token = signToken({
        userId: matchedMember.id,
        email: matchedMember.email,
        name: matchedMember.name,
        role: matchedMember.role,
        orgId: org.id,
        orgSlug: org.slug,
        orgName: org.name,
        orgColor: org.color,
        activeOrgId: org.id,
        activeOrgSlug: org.slug,
        activeOrgName: org.name,
        activeOrgColor: org.color,
        allowedPages: org.allowed_pages?.length ? org.allowed_pages : ALL_PAGES,
        memberOrgIds,
      });

      const response = NextResponse.json({
        success: true,
        role: matchedMember.role,
        orgName: org.name,
      });
      setCookie(response, token);
      return response;
    }

    // ── STEP 3: Check org contact email (org-level login) ─────────────────────
    const orgByEmail = await OrgModel.findByEmail(cleanEmail);

    if (orgByEmail) {
      const token = signToken({
        userId: orgByEmail.id,
        email: cleanEmail,
        name: orgByEmail.name,
        role: "org_admin",
        orgId: orgByEmail.id,
        orgSlug: orgByEmail.slug,
        orgName: orgByEmail.name,
        orgColor: orgByEmail.color,
        activeOrgId: orgByEmail.id,
        activeOrgSlug: orgByEmail.slug,
        activeOrgName: orgByEmail.name,
        activeOrgColor: orgByEmail.color,
        allowedPages: orgByEmail.allowed_pages?.length ? orgByEmail.allowed_pages : ALL_PAGES,
      });

      const response = NextResponse.json({
        success: true,
        role: "org_admin",
        orgName: orgByEmail.name,
      });
      setCookie(response, token);
      return response;
    }

    return NextResponse.json(
      { message: "No account found with this email address." },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ message: "Server error: " + error.message }, { status: 500 });
  }
}
