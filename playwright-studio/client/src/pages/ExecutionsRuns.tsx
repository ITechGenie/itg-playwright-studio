import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
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
  HistoryIcon,
  FileTextIcon,
  RefreshCwIcon,
  Loader2Icon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  XIcon,
  InfoIcon,
  TerminalIcon,
  DownloadIcon
} from "lucide-react"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"

interface ExecutionRun {
  runId: string;
  projectId: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  command: string;
  duration: number; // ms
  triggeredBy: string;
  path: string;
  targetPaths?: string[];
  hasHtmlReport: boolean;
  hasMonocartReport: boolean;
}

export default function ExecutionsRuns() {
  const { id: projectId } = useParams<{ id: string }>();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [hasMore, setHasMore] = useState(true);

  // Filter State
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterError, setFilterError] = useState('');

  const fetchRuns = async () => {
    if (!projectId) return;
    setLoading(true);
    setFilterError('');
    
    try {
      const data = await apiClient.getRuns(projectId, {
        page,
        limit: pageSize,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      setRuns(data);
      // If we got exactly the page size, assume there might be more
      setHasMore(data.length === pageSize);
    } catch (err: any) {
      console.error("Failed to fetch runs:", err);
      // Backend returns 400 for range > 2 weeks
      setFilterError('Verify date range (max 2 weeks allowed)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [projectId, page, statusFilter, startDate, endDate]);

  const handleRerun = async (run: ExecutionRun) => {
    if (!projectId) return;
    try {
      await apiClient.runTests(projectId, { path: run.path });
      setPage(1); // Reset to first page
      fetchRuns();
    } catch (err) {
      console.error("Failed to re-run test", err);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">PASS</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">FAIL</span>;
      case 'running':
        return <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold border border-blue-500/20 animate-pulse">RUNNING</span>;
      case 'stopped':
        return <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-500 text-[10px] font-bold border border-orange-500/20">STOPPED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-zinc-500/10 text-zinc-500 text-[10px] font-bold border border-zinc-500/20 uppercase">{status}</span>;
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PageHeader 
        title="Execution History" 
        description="Review previous test results, logs, and reports across your project."
        action={
          <Button 
            size="lg"
            onClick={fetchRuns} 
            disabled={loading} 
            className="bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 transition-all px-6"
          >
            <RefreshCwIcon className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh History
          </Button>
        }
      />
      
      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-2 space-y-6">
          
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              {['all', 'completed', 'failed', 'running'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn(
                    "px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    statusFilter === s 
                      ? "bg-zinc-800 text-white shadow-lg" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {s === 'completed' ? 'Pass' : s === 'failed' ? 'Fail' : s}
                </button>
              ))}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-[11px] text-zinc-300 focus:ring-0 outline-none w-28 [color-scheme:dark]"
              />
              <span className="text-zinc-700 text-xs px-1">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-[11px] text-zinc-300 focus:ring-0 outline-none w-28 [color-scheme:dark]"
              />
            </div>

            {(statusFilter !== 'all' || startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-9 text-[11px] text-zinc-500 hover:text-white"
              >
                <XIcon className="h-3.5 w-3.5 mr-2" />
                Reset Filters
              </Button>
            )}
          </div>

          {filterError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2">
              {filterError}
            </div>
          )}

          {/* Records Table */}
          <div className="border rounded-2xl bg-zinc-950/40 overflow-hidden border-zinc-800 shadow-xl">
            <Table>
              <TableHeader className="bg-zinc-900/50">
                <TableRow className="hover:bg-transparent border-zinc-800">
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500 pl-6 h-12">Project Path</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">Command</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">Duration</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">Date/Time</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">By</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500">Reports</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-zinc-500 text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
                        <Loader2Icon className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="text-sm font-medium tracking-tight">Syncing execution history...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <HistoryIcon className="h-8 w-8 opacity-20 mb-2" />
                        <span className="text-sm">No execution records found matching your filters.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => (
                    <TableRow key={run.runId} className="group hover:bg-zinc-900/40 border-zinc-800/50 transition-colors">
                      <TableCell className="text-xs font-semibold text-blue-400 pl-6">
                        {run.path || 'Root Project'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate cursor-pointer" onClick={() => setSelectedRun(run)}>
                        <div className="flex items-center gap-2 group/cmd">
                          <code className="text-[10px] text-zinc-500 font-mono truncate bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50">
                            {run.command}
                          </code>
                          <InfoIcon className="h-3 w-3 text-zinc-700 group-hover/cmd:text-blue-500 transition-colors shrink-0" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(run.status)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300 font-medium">
                        {formatDuration(run.duration)}
                      </TableCell>
                      <TableCell className="text-[10px] text-zinc-400">
                        <div className="flex flex-col">
                          <span className="text-zinc-200">{new Date(run.timestamp).toLocaleDateString()}</span>
                          <span className="text-zinc-600 tabular-nums">{new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <UserIcon className="h-3 w-3" />
                          <span className="text-[10px] font-medium">{run.triggeredBy}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          {run.hasMonocartReport ? (
                            <button
                              onClick={() => window.open(apiClient.getReportUrl(projectId!, run.runId, 'monocart'), '_blank')}
                              className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors group/link"
                            >
                              <FileTextIcon className="h-3.5 w-3.5" />
                              <span className="border-b border-indigo-400/30 group-hover/link:border-indigo-300">Monocart</span>
                            </button>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-800 cursor-not-allowed">
                              <FileTextIcon className="h-3.5 w-3.5 opacity-50" />
                              <span className="opacity-30">None</span>
                            </span>
                          )}
                          {run.hasHtmlReport ? (
                            <button
                              onClick={() => window.open(apiClient.getReportUrl(projectId!, run.runId, 'html'), '_blank')}
                              className="flex items-center gap-1.5 text-[10px] text-orange-400 hover:text-orange-300 transition-colors group/link"
                            >
                              <ExternalLinkIcon className="h-3.5 w-3.5" />
                              <span className="border-b border-orange-400/30 group-hover/link:border-orange-300">HTML</span>
                            </button>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-800 cursor-not-allowed">
                              <ExternalLinkIcon className="h-3.5 w-3.5 opacity-50" />
                              <span className="opacity-30">None</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 py-0 font-bold uppercase tracking-wider"
                          onClick={() => handleRerun(run)}
                        >
                          Re-run
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination Footer */}
            <div className="bg-zinc-900/40 px-6 py-4 border-t border-zinc-800/80 flex items-center justify-between">
              <div className="text-[11px] text-zinc-500 font-medium">
                Showing page <span className="text-zinc-200">{page}</span> of records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 shadow-sm"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-zinc-800 mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 shadow-sm"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Details Sheet */}
      <Sheet open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent className="sm:!max-w-[90%] !w-[90%] bg-zinc-950 border-zinc-800 text-white overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-blue-500" />
              Execution Details
            </SheetTitle>
            <SheetDescription className="text-zinc-500">
              Run ID: <span className="font-mono text-[10px] text-zinc-400">{selectedRun?.runId}</span>
            </SheetDescription>
          </SheetHeader>

          {selectedRun && (
            <div className="space-y-6">
              {/* Status Section */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Status</p>
                  <div>{getStatusBadge(selectedRun.status)}</div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Duration</p>
                  <p className="text-sm font-medium tabular-nums">{formatDuration(selectedRun.duration)}</p>
                </div>
              </div>

              {/* Execution Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <UserIcon className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-300">Run by {selectedRun.triggeredBy}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">
                    {new Date(selectedRun.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Targeted Files */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-2">
                  <FileTextIcon className="h-3 w-3" />
                  Targeted Files {selectedRun.targetPaths && `(${selectedRun.targetPaths.length})`}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                  {selectedRun.targetPaths ? (
                    selectedRun.targetPaths.map((p, i) => (
                      <div key={i} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-[11px] font-mono text-blue-400 truncate">
                        {p}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-[11px] font-mono text-blue-400">
                      {selectedRun.path || "All Tests"}
                    </div>
                  )}
                </div>
              </div>

              {/* Full Command */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-2">
                  <TerminalIcon className="h-3 w-3" />
                  Launch Command
                </p>
                <div className="p-3 bg-black rounded-xl border border-zinc-800">
                  <code className="text-[10px] text-zinc-400 font-mono break-all leading-relaxed whitespace-pre-wrap">
                    {selectedRun.command}
                  </code>
                </div>
              </div>

              {/* Reports Quick Link */}
              {(selectedRun.hasHtmlReport || selectedRun.hasMonocartReport || (selectedRun as any).hasHar) && (
                <div className="pt-4 space-y-3">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Reports & Artifacts</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRun.hasMonocartReport && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/10"
                        onClick={() => window.open(apiClient.getReportUrl(projectId!, selectedRun.runId, 'monocart'), '_blank')}
                      >
                        <ExternalLinkIcon className="h-3 w-3 mr-2" />
                        Monocart View
                      </Button>
                    )}
                    {selectedRun.hasHtmlReport && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10"
                        onClick={() => window.open(apiClient.getReportUrl(projectId!, selectedRun.runId, 'html'), '_blank')}
                      >
                        <ExternalLinkIcon className="h-3 w-3 mr-2" />
                        HTML View
                      </Button>
                    )}
                    {(selectedRun as any).hasHar && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => {
                          const url = `/apis/reports/${projectId}/runs/${selectedRun.runId}/test-results/network.har`;
                          window.open(url, '_blank');
                        }}
                      >
                        <DownloadIcon className="h-3 w-3 mr-2" />
                        Download HAR
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              <div className="pt-6">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11"
                  onClick={() => {
                    if (selectedRun) handleRerun(selectedRun);
                    setSelectedRun(null);
                  }}
                >
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Re-run This Set
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
