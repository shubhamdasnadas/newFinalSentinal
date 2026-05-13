/**
 * POST /api/harmony/auth
 *
 * Proxies the Check Point Harmony Email & Collaboration authentication request.
 * Accepts { clientId, accessKey } and returns { token } on success.
 * Running this server-side avoids CORS issues and keeps credentials off the browser network tab.
 */

import { NextRequest, NextResponse } from "next/server";

const CHECKPOINT_AUTH_URL =
  "https://cloudinfra-gw.in.portal.checkpoint.com/auth/external";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, accessKey } = body as {
      clientId?: string;
      accessKey?: string;
    };

    if (!clientId?.trim() || !accessKey?.trim()) {
      return NextResponse.json(
        { error: "clientId and accessKey are required." },
        { status: 400 }
      );
    }

    const upstream = await fetch(CHECKPOINT_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId.trim(),
        accessKey: accessKey.trim(),
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Auth failed (${upstream.status})`, detail: data },
        { status: upstream.status }
      );
    }

    // Normalise token across possible response shapes
    const token: string | undefined =
      data?.data?.token ?? data?.token ?? data?.access_token;

    if (!token) {
      return NextResponse.json(
        {
          error: "No token returned from Check Point auth endpoint.",
          raw: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
