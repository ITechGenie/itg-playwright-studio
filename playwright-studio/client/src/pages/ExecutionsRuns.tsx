import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { 
  ExternalLinkIcon, 
  FileTextIcon, 
  HistoryIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ExecutionRun {
  runId: string;
  projectId: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';
  hasHtmlReport: boolean;
  hasMonocartReport: boolean;
}

const API_URL = "http://localhost:3000";

export default function ExecutionsRuns() {
  const { id: projectId } = useParams();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/runs`);
      const data = await res.json();
      setRuns(data);
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [projectId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'running': return <Loader2Icon className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <HistoryIcon className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Execution History</h1>
          <p className="text-muted-foreground text-sm">
            Browse previous test runs and diagnostic reports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
          <RefreshCwIcon className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Reload
        </Button>
      </div>

      <div className="border rounded-lg bg-zinc-900/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/80">
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Run ID</TableHead>
              <TableHead>Started At</TableHead>
              <TableHead className="text-right">Reports</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Scanning executions folder...
                  </div>
                </TableCell>
              </TableRow>
            ) : runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                  No execution records found.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => (
                <TableRow key={run.runId} className="group hover:bg-zinc-800/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <span className="capitalize text-xs font-medium">
                        {run.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/app/project/${projectId}/run/${run.runId}`}
                      className="font-mono text-xs text-zinc-400 group-hover:text-blue-400 transition-colors"
                    >
                      {run.runId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs">
                    {new Date(run.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {run.hasHtmlReport && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-white"
                          onClick={() => window.open(`${API_URL}/api/reports/${projectId}/runs/${run.runId}/report/html/index.html`, '_blank')}
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                          HTML
                        </Button>
                      )}
                      {run.hasMonocartReport && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={() => window.open(`${API_URL}/api/reports/${projectId}/runs/${run.runId}/report/monocart/index.html`, '_blank')}
                        >
                          <FileTextIcon className="h-3.5 w-3.5" />
                          Monocart
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
