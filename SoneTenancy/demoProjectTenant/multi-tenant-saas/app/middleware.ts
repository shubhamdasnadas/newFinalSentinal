import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const user = verifyToken(token);

    // Super admin trying to access org-specific pages without active org
    // Allow — they'll see a "select org" prompt in the UI

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set("token", "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
