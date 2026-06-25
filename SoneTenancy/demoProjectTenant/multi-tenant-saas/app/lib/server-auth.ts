import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, TokenPayload } from "./auth";

export async function getServerUser(): Promise<TokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");
  try {
    return verifyToken(token);
  } catch {
    redirect("/login");
  }
}

export async function getServerOrgContext(): Promise<{
  user: TokenPayload;
  orgSlug: string;
  orgName: string;
}> {
  const user = await getServerUser();
  const orgSlug = user.activeOrgSlug || user.orgSlug;
  if (!orgSlug) redirect("/select-org");
  const orgName = user.activeOrgName || user.orgName || orgSlug;
  return { user, orgSlug, orgName };
}
