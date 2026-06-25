import { getServerOrgContext } from "../../lib/server-auth";
import { ProjectModel } from "../../models/OrgModels";
import ProjectsClient from "./ProjectsClient";

export default async function ProjectsPage() {
  const { user, orgSlug, orgName } = await getServerOrgContext();
  const projects = await ProjectModel.findAll(orgSlug);
  const canManage = user.role === "super_admin" || user.role === "org_admin";

  return (
    <ProjectsClient
      initialProjects={projects as any}
      orgSlug={orgSlug}
      orgName={orgName}
      canManage={canManage}
    />
  );
}
