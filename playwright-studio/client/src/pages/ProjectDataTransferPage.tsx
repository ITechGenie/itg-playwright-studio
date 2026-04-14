import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { DataTransferControls } from '@/components/data-transfer-controls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectDataTransferPage() {
  const { id: projectId } = useParams<{ id: string }>();
  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader
        title="Export / Import Data"
        description="Export or import project-specific data including configs, templates, environments, datasets, schedules and executions."
      />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl w-full mx-auto p-6">
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Export / Import</CardTitle>
              <CardDescription className="text-xs">
                Export creates a ZIP archive of all project data. Import restores from a previously exported archive — existing records are updated, new ones are inserted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTransferControls apiBasePath={`/apis/admin/${projectId}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
