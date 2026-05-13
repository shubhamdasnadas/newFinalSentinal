import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../../lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Try cookie first (primary method)
    let token = req.cookies.get("token")?.value;

    // Fallback: Authorization header
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    return NextResponse.json({ user: payload });
  } catch (err: any) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
}
