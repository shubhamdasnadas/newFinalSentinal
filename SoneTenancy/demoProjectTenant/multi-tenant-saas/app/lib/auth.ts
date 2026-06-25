import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_in_production";

export interface TokenPayload {
  userId: string;
  email: string;
  name?: string;
  role: "super_admin" | "org_admin" | "org_user";
  orgId?: string;
  orgSlug?: string;
  orgName?: string;
  activeOrgId?: string;
  activeOrgSlug?: string;
  activeOrgName?: string;
  allowedPages?: string[];
  pendingOrgIds?: string[];
  memberOrgIds?: string[];
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, SECRET) as TokenPayload;
};
