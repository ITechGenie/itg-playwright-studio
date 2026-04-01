"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { XIcon, PlayIcon, RotateCcwIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api-client";
import { WS_ENDPOINT } from "@/services/api-endpoints";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

// Simple ANSI to HTML converter
function ansiToHtml(text: string): string {
  const ansiColors: Record<string, string> = {
    '30': '#000000', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
    '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#d1d5db',
    '90': '#6b7280', '91': '#f87171', '92': '#4ade80', '93': '#fbbf24',
    '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#f3f4f6',
  };

  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  result = result.replace(/\x1b\[([0-9;]+)m/g, (_match, codes) => {
    const codeList = codes.split(';');
    if (codeList.includes('0') || codes === '') return '</span>';
    const colorCode = codeList.find((code: string) => ansiColors[code]);
    if (colorCode && ansiColors[colorCode]) return `<span style="color: ${ansiColors[colorCode]}">`;
    return '';
  });

  return result;
}

export interface TestRunnerPanelProps {
  projectId: string;
  targetPath?: string;
  targetPaths?: string[];
  initialRunId?: string;
  onClose?: () => void;
  showNewTab?: boolean;
  browser?: string;
  width?: number;
  height?: number;
  baseURL?: string;
  video?: string;
  screenshot?: string;
}

interface LogLine {
  id: number;
  type: "stdout" | "stderr" | "info" | "done" | "error";
  text: string;
}

let _lineSeq = 0;

export function TestRunnerPanel({ 
  projectId, 
  targetPath = "", 
  targetPaths,
  initialRunId, 
  onClose,
  showNewTab = true,
  browser = "chromium",
  width = 1280,
  height = 720,
  baseURL = "http://localhost:5173",
  video = "retain-on-failure",
  screenshot = "only-on-failure",
}: TestRunnerPanelProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(initialRunId || null);
  const [headless, setHeadless] = useState(true);
  const [workers, setWorkers] = useState("1");
  const [grep, setGrep] = useState("");
  
  // Data Manager States
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>("");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogLine["type"], text: string) => {
    setLogs(prev => [...prev, { id: _lineSeq++, type, text }]);
  }, []);

  // ── Fetch Environments ───────────────────────────────────────────────────
  useEffect(() => {
    apiClient.getDataEnvironments(projectId)
      .then(data => setEnvironments(data))
      .catch(err => console.error("Failed to fetch environments", err));
  }, [projectId]);

  // Update datasets when environment changes
  useEffect(() => {
    setSelectedDatasetIds([]);
  }, [selectedEnvId]);

  // ── Fetch existing logs if attaching to a run ────────────────────────────
  useEffect(() => {
    if (initialRunId) {
      apiClient.getRunDetails(projectId, initialRunId)
        .then(data => {
          if (data.logs) {
            const history = data.logs.map((l: any) => ({
              id: _lineSeq++,
              type: l.type,
              text: l.data
            }));
            setLogs(history);
            if (data.status !== 'running') {
              setRunning(false);
              setExitCode(data.exitCode ?? 0);
            } else {
              setRunning(true);
            }
          }
        })
        .catch(err => console.error("Failed to fetch run history", err));
    }
  }, [initialRunId, projectId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── WebSocket connection ─────────────────────────────────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${WS_ENDPOINT}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (!msg.runId) return;
        if (msg.runId !== runId && runId !== null) return;

        switch (msg.type) {
          case "run:start":
            if (!runId) setRunId(msg.runId);
            setRunning(true);
            addLog("info", `▶ Starting: ${msg.command}`);
            break;
          case "run:stdout":
            msg.data.split("\n").forEach((line: string) => {
              if (line.trim()) addLog("stdout", line);
            });
            break;
          case "run:stderr":
            msg.data.split("\n").forEach((line: string) => {
              if (line.trim()) addLog("stderr", line);
            });
            break;
          case "run:done":
            setRunning(false);
            setExitCode(msg.exitCode ?? -1);
            addLog("done", msg.exitCode === 0 ? "✅ All tests passed!" : `❌ Tests failed (exit ${msg.exitCode})`);
            break;
          case "run:error":
            setRunning(false);
            addLog("error", `🚨 Error: ${msg.error}`);
            break;
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [runId]);

  // ── Trigger a run ────────────────────────────────────────────────────────
  const handleRun = async () => {
    setLogs([]);
    setExitCode(null);
    setRunning(true);

    try {
      const options = {
        path: targetPath,
        paths: targetPaths,
        headless,
        workers: parseInt(workers) || 1,
        browser,
        width,
        height,
        baseURL,
        video,
        screenshot,
        grep: grep || undefined,
        envId: selectedEnvId || undefined,
        dataSetIds: selectedDatasetIds.length > 0 ? selectedDatasetIds : undefined,
      };

      const data = await apiClient.runTests(projectId, options);
      setRunId(data.runId);
      addLog("info", `🆔 Run ID: ${data.runId}`);
    } catch (e: any) {
      addLog("error", `Network error: ${e.message}`);
      setRunning(false);
    }
  };

  const statusBadge = () => {
    if (running) return <Badge variant="secondary" className="animate-pulse">Running…</Badge>;
    if (exitCode === null) return null;
    return exitCode === 0
      ? <Badge className="bg-green-600 text-white font-bold">Passed</Badge>
      : <Badge variant="destructive" className="font-bold">Failed (exit {exitCode})</Badge>;
  };

  const lineColor = (type: LogLine["type"]) => {
    switch (type) {
      case "stderr": return "text-red-400";
      case "info":   return "text-blue-300";
      case "done":   return exitCode === 0 ? "text-green-400" : "text-red-400";
      case "error":  return "text-red-500 font-bold";
      default:       return "text-zinc-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-sm font-mono rounded-t-lg border border-zinc-800 overflow-hidden shadow-2xl">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 flex-wrap gap-y-2">
        <span className="text-zinc-300 font-semibold truncate max-w-[200px]">
          {targetPaths ? `${targetPaths.length} files` : (targetPath || "All tests")} {statusBadge()}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <Switch
            id="headless-toggle"
            checked={headless}
            onCheckedChange={setHeadless}
            disabled={running}
            className="scale-75 data-[state=checked]:bg-blue-600"
          />
          <Label htmlFor="headless-toggle" className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">Headless</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">Workers</Label>
          <Input
            value={workers}
            onChange={e => setWorkers(e.target.value)}
            disabled={running}
            className="h-6 w-10 px-1.5 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">Filter</Label>
          <Input
            value={grep}
            onChange={e => setGrep(e.target.value)}
            placeholder="regex…"
            disabled={running}
            className="h-6 w-24 px-1.5 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
          />
        </div>
        
        {/* Data Manager Environments Selection */}
        {environments.length > 0 && (
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
            <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">Env</Label>
            <Select value={selectedEnvId} onValueChange={setSelectedEnvId} disabled={running}>
              <SelectTrigger className="h-6 w-[120px] text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300">
                <SelectValue placeholder="Base Env" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {environments.map(env => (
                  <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Multi-Select Datasets Dropdown */}
            {selectedEnvId && selectedEnvId !== "none" && (
              <>
                <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight ml-2">Datasets</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={running}>
                    <Button variant="outline" className="h-6 px-2 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300 min-w-[100px] justify-start text-left font-normal truncate">
                      {selectedDatasetIds.length > 0 ? `${selectedDatasetIds.length} scenario${selectedDatasetIds.length > 1 ? 's' : ''}` : "Add test scenarios..."}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    <DropdownMenuLabel className="text-xs">Data Set Scenarios</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {environments.find(e => e.id === selectedEnvId)?.datasets?.length ? (
                       environments.find(e => e.id === selectedEnvId)?.datasets.map((ds: any) => (
                         <DropdownMenuCheckboxItem
                            key={ds.id}
                            className="text-xs"
                            checked={selectedDatasetIds.includes(ds.id)}
                            onCheckedChange={(checked) => {
                              setSelectedDatasetIds(prev => 
                                checked 
                                  ? [...prev, ds.id] 
                                  : prev.filter(id => id !== ds.id)
                              )
                            }}
                         >
                           {ds.name}
                         </DropdownMenuCheckboxItem>
                       ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">No datasets defined.</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}

        <div className="flex-1" />
        {showNewTab && runId && (
          <Button
            size="sm" variant="ghost"
            onClick={() => window.open(`/app/project/${projectId}/run/${runId}`, '_blank')}
            className="h-7 text-[10px] text-zinc-500 hover:text-white gap-1 hover:bg-zinc-800"
            title="Open in new tab"
          >
            <ExternalLinkIcon className="h-3 w-3" />
            <span className="hidden sm:inline">New Tab</span>
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={() => setLogs([])}
          disabled={running}
          className="h-7 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800"
          title="Clear output"
        >
          <RotateCcwIcon className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className={cn("h-7 text-xs gap-1.5 font-bold px-4", running ? "bg-zinc-800 text-zinc-500" : "bg-blue-700 hover:bg-blue-600 text-white")}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {running ? "Running…" : "Run"}
        </Button>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0 text-zinc-600 hover:text-white hover:bg-red-500/20">
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Terminal Output ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 selection:bg-blue-500/30">
        {logs.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700">
             <PlayIcon className="h-8 w-8 mb-2 opacity-20" />
             <p className="text-[10px] uppercase font-bold tracking-widest">
               READY TO EXECUTE {targetPaths ? `(${targetPaths.length} files)` : (targetPath ? `"${targetPath}"` : "WORKSPACE")}
             </p>
          </div>
        )}
        {logs.map(line => (
          <div 
            key={line.id} 
            className={cn("whitespace-pre-wrap break-all leading-relaxed font-mono text-[11px]", lineColor(line.type))}
            dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
