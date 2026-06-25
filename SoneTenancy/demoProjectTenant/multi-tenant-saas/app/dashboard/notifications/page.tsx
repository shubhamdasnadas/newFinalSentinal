import { getServerOrgContext } from "../../lib/server-auth";
import { NotificationModel } from "../../models/OrgModels";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const { user, orgSlug, orgName } = await getServerOrgContext();
  const notifications = await NotificationModel.findAll(orgSlug);
  const canCreate = user.role === "super_admin" || user.role === "org_admin";

  return (
    <NotificationsClient
      initialNotifications={notifications as any}
      orgSlug={orgSlug}
      orgName={orgName}
      canCreate={canCreate}
    />
  );
}
