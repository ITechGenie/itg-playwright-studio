import { useNavigate } from 'react-router-dom';
import { UserManagementPanel } from '@/components/user-management-panel';
import { DataTransferControls } from '@/components/data-transfer-controls';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';

const BASE_PATH = '/apis/superadmin';

export default function StudioSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950/50 px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-white"
          onClick={() => navigate('/app/projects')}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="text-sm text-zinc-400">Playwright Studio</span>
        <span className="text-zinc-700">›</span>
        <span className="text-sm text-white font-medium">Studio Settings</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Studio Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all users, roles, and data across the Studio instance.
          </p>
        </div>

        <Separator className="border-zinc-800" />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">User Management</h2>
            <p className="text-sm text-muted-foreground">
              List and manage all users. Search by exact email or provider ID.
            </p>
          </div>
          <UserManagementPanel apiBasePath={BASE_PATH} mode="global" />
        </section>

        <Separator className="border-zinc-800" />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Data Export / Import</h2>
            <p className="text-sm text-muted-foreground">
              Export all Studio data as a ZIP archive, or import a previously exported archive.
            </p>
          </div>
          <DataTransferControls apiBasePath={BASE_PATH} />
        </section>
      </div>
    </div>
  );
}
