import { getServerOrgContext } from "../../lib/server-auth";
import { SupportTicketModel } from "../../models/OrgModels";
import SupportClient from "./SupportClient";

export default async function SupportPage() {
  const { orgSlug, orgName } = await getServerOrgContext();
  const tickets = await SupportTicketModel.findAll(orgSlug);

  return (
    <SupportClient
      initialTickets={tickets as any}
      orgSlug={orgSlug}
      orgName={orgName}
    />
  );
}
