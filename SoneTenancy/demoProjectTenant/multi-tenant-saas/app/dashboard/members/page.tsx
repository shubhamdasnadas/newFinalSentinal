import { getServerOrgContext } from "../../lib/server-auth";
import { OrgUserModel } from "../../models/OrgModels";
import MembersClient from "./MembersClient";

export default async function MembersPage() {
  const { user, orgSlug, orgName } = await getServerOrgContext();
  const members = await OrgUserModel.findAll(orgSlug);
  const canManage = user.role === "super_admin" || user.role === "org_admin";

  return (
    <MembersClient
      initialMembers={members as any}
      orgSlug={orgSlug}
      orgName={orgName}
      canManage={canManage}
    />
  );
}
