import { useParams } from 'react-router-dom';
import { UserManagementPanel } from '@/components/user-management-panel';
import { PageHeader } from '@/components/page-header';

export default function ProjectUsersPage() {
  const { id: projectId } = useParams<{ id: string }>();

  if (!projectId) return null;

  const basePath = `/apis/admin/${projectId}`;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader
        title="User Management"
        description="Manage users and roles for this project."
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl w-full mx-auto p-6">
          <UserManagementPanel apiBasePath={basePath} mode="project" />
        </div>
      </div>
    </div>
  );
}
