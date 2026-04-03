"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { XIcon, PlayIcon, RotateCcwIcon, SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api-client";
import { WS_ENDPOINT } from "@/services/api-endpoints";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2Icon, CheckCircleIcon, XCircleIcon, ExternalLinkIcon } from "lucide-react"

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
  runConfig: {
    browsers: string[];
    headless: boolean;
    workers: number;
    width: number;
    height: number;
    baseURL: string;
    video: string;
    screenshot: string;
    timeout: number;
    extraArgs: { flag: string; value: string }[];
  };
}

interface LogLine {
  id: number;
  type: "stdout" | "stderr" | "info" | "done" | "error";
  text: string;
}

interface ActiveRun {
  runId: string;
  command: string;
  datasetName: string;
  status: "running" | "done" | "error";
  exitCode: number | null;
  logs: LogLine[];
}

let _lineSeq = 0;

export function TestRunnerPanel({
  projectId,
  targetPath = "",
  targetPaths,
  initialRunId,
  onClose,
  runConfig,
}: TestRunnerPanelProps) {
  // Runner States
  const [runsMap, setRunsMap] = useState<Record<string, ActiveRun>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(initialRunId || null);

  // Local overrides (initialized from runConfig)
  const [localConfig, setLocalConfig] = useState(runConfig);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [grep, setGrep] = useState("");

  // Data Manager States
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>("");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeRunsList = Object.values(runsMap);
  const isRunning = activeRunsList.some(r => r.status === "running");

  // ── Fetch Environments ───────────────────────────────────────────────────
  useEffect(() => {
    apiClient.getDataEnvironments(projectId)
      .then(data => setEnvironments(data))
      .catch(err => console.error("Failed to fetch environments", err));
  }, [projectId]);

  // Update datasets when environment changes
  useEffect(() => {
    setSelectedDatasetIds([]);
    
    if (selectedEnvId && selectedEnvId !== "none") {
      apiClient.getDataEnvironment(projectId, selectedEnvId)
        .then(fullEnv => {
          setEnvironments(prev => prev.map(e => e.id === fullEnv.id ? fullEnv : e));
        })
        .catch(err => console.error("Failed to fetch env details in runner", err));
    }
  }, [selectedEnvId, projectId]);

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
            setRunsMap({
              [initialRunId]: {
                runId: initialRunId,
                command: data.command || "",
                datasetName: "",
                status: data.status,
                exitCode: data.exitCode,
                logs: history
              }
            });
            setActiveTabId(initialRunId);
          }
        })
        .catch(err => console.error("Failed to fetch run history", err));
    }
  }, [initialRunId, projectId]);

  // Auto-scroll inside current active tab
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runsMap, activeTabId]);

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

        setRunsMap(prev => {
          // Find or create run entry
          const r = prev[msg.runId] || {
            runId: msg.runId,
            command: msg.command || "Unknown command",
            datasetName: msg.datasetName || " [Default]",
            status: "running",
            exitCode: null,
            logs: []
          };

          const newLogs = [...r.logs];
          let newStatus = r.status;
          let newExitCode = r.exitCode;

          switch (msg.type) {
            case "run:start":
              newStatus = "running";
              if (msg.datasetName) r.datasetName = msg.datasetName;
              if (msg.command) r.command = msg.command;
              newLogs.push({ id: _lineSeq++, type: "info", text: `▶ Starting: ${r.command}` });
              break;
            case "run:stdout":
              msg.data.split("\n").forEach((line: string) => {
                if (line.trim()) newLogs.push({ id: _lineSeq++, type: "stdout", text: line });
              });
              break;
            case "run:stderr":
              msg.data.split("\n").forEach((line: string) => {
                if (line.trim()) newLogs.push({ id: _lineSeq++, type: "stderr", text: line });
              });
              break;
            case "run:done":
              newStatus = "done";
              newExitCode = msg.exitCode ?? -1;
              newLogs.push({ id: _lineSeq++, type: "done", text: newExitCode === 0 ? "✅ All tests passed!" : `❌ Tests failed (exit ${newExitCode})` });
              break;
            case "run:error":
              newStatus = "error";
              newLogs.push({ id: _lineSeq++, type: "error", text: `🚨 Server Error: ${msg.error}` });
              break;
          }

          return { ...prev, [msg.runId]: { ...r, logs: newLogs, status: newStatus, exitCode: newExitCode } };
        });
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, []);

  // ── Trigger a run ────────────────────────────────────────────────────────
  const handleRun = async () => {
    try {
      const options = {
        path: targetPath,
        paths: targetPaths,
        headless: localConfig.headless,
        workers: localConfig.workers,
        browsers: localConfig.browsers,
        width: localConfig.width,
        height: localConfig.height,
        baseURL: localConfig.baseURL,
        video: localConfig.video,
        screenshot: localConfig.screenshot,
        timeout: localConfig.timeout,
        extraArgs: localConfig.extraArgs,
        grep: grep || undefined,
        envId: selectedEnvId !== "none" ? selectedEnvId : undefined,
        dataSetIds: selectedDatasetIds.length > 0 ? selectedDatasetIds : undefined,
      };

      const data = await apiClient.runTests(projectId, options);
      const newlySpawned = Array.isArray(data.runs) ? data.runs : [data];

      const newMap: Record<string, ActiveRun> = {};
      newlySpawned.forEach((r: any) => {
        newMap[r.runId] = {
          runId: r.runId,
          command: r.command,
          datasetName: r.datasetName || " [Default]",
          status: "running",
          exitCode: null,
          logs: [{ id: _lineSeq++, type: 'info', text: `🆔 Queuting Run ID: ${r.runId}` }]
        };
      });

      setRunsMap(newMap);
      if (newlySpawned.length > 0) setActiveTabId(newlySpawned[0].runId);

    } catch (e: any) {
      console.error(e)
    }
  };

  const statusBadge = () => {
    if (activeRunsList.length === 0) return null;

    if (isRunning) return <Badge variant="secondary" className="animate-pulse">Building Executions…</Badge>;

    const failedRuns = activeRunsList.filter(r => r.exitCode !== 0 && r.status === "done");
    if (failedRuns.length > 0) {
      return <Badge variant="destructive" className="font-bold">{failedRuns.length} Failed</Badge>;
    }

    return <Badge className="bg-green-600 text-white font-bold">All Passed</Badge>;
  };

  const lineColor = (type: LogLine["type"], exitCode: number | null) => {
    switch (type) {
      case "stderr": return "text-red-400";
      case "info": return "text-blue-300";
      case "done": return exitCode === 0 ? "text-green-400" : "text-red-400";
      case "error": return "text-red-500 font-bold";
      default: return "text-zinc-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-sm rounded-t-lg border border-zinc-800 overflow-hidden shadow-2xl">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 flex-wrap gap-y-2">
        <span className="text-zinc-300 font-semibold truncate max-w-[200px]">
          {targetPaths ? `${targetPaths.length} files` : (targetPath || "All tests")} {statusBadge()}
        </span>

        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-6 px-2 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white transition-all",
            isConfigExpanded && "bg-zinc-800 text-white border-zinc-600"
          )}
          onClick={() => setIsConfigExpanded(!isConfigExpanded)}
        >
          <SettingsIcon className="h-3 w-3 mr-1.5 opacity-70" />
          Config {isConfigExpanded ? "▲" : "▼"}
        </Button>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        <div className="flex items-center gap-1.5">
          <Label className="text-zinc-500 text-[10px] uppercase font-bold">Filter</Label>
          <Input
            value={grep}
            onChange={e => setGrep(e.target.value)}
            placeholder="regex…"
            disabled={isRunning}
            className="h-6 w-24 px-1.5 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
          />
        </div>

        {/* Data Manager Environments Selection */}
        {environments.length > 0 && (
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
            <Label className="text-zinc-500 text-[10px] uppercase font-bold">Env</Label>
            <Select value={selectedEnvId} onValueChange={setSelectedEnvId} disabled={isRunning}>
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
                <Label className="text-zinc-500 text-[10px] uppercase font-bold ml-2">Datasets</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isRunning}>
                    <Button variant="outline" className="h-6 px-2 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300 min-w-[100px] justify-start text-left font-normal truncate hover:text-white hover:bg-zinc-800">
                      {selectedDatasetIds.length > 0 ? `${selectedDatasetIds.length} scenario${selectedDatasetIds.length > 1 ? 's' : ''}` : "Select variants..."}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-300" align="start">
                    <DropdownMenuLabel className="text-xs text-white">Data Scenarios</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    {environments.find(e => e.id === selectedEnvId)?.datasets?.length ? (
                      environments.find(e => e.id === selectedEnvId)?.datasets.map((ds: any) => (
                        <DropdownMenuCheckboxItem
                          key={ds.id}
                          className="text-xs focus:bg-blue-600 focus:text-white"
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
                      <div className="p-2 text-xs text-zinc-500">No configs created.</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}

        <div className="flex-1" />
        <Button
          size="sm" variant="ghost"
          onClick={() => setRunsMap({})}
          disabled={isRunning}
          className="h-7 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800"
          title="Clear Terminal outputs"
        >
          <RotateCcwIcon className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={isRunning}
          className={cn("h-7 text-xs gap-1.5 font-bold px-4", isRunning ? "bg-zinc-800 text-zinc-500" : "bg-blue-700 hover:bg-blue-600 text-white")}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {isRunning ? "Running Sandbox…" : "Run Tests"}
        </Button>
        {onClose && (
          <Button 
            size="sm" 
            onClick={onClose} 
            className="h-7 text-xs gap-1.5 font-bold px-4 bg-red-900/80 hover:bg-red-700 text-red-100 ml-2"
          >
            <XIcon className="h-3.5 w-3.5" />
            Close
          </Button>
        )}
      </div>

      {/* ── Collapsible Config Override Section ── */}
      {isConfigExpanded && (
        <div className="bg-zinc-900 border-b border-zinc-800 p-3 grid grid-cols-4 gap-4 animate-in slide-in-from-top duration-200">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-zinc-500">Browsers</Label>
            <div className="flex flex-wrap gap-1">
              {['chromium', 'firefox', 'webkit', 'chrome', 'msedge'].map(b => (
                <Badge
                  key={b}
                  variant="outline"
                  className={cn(
                    "cursor-pointer text-[9px] px-1.5 py-0 capitalize border-zinc-700 text-zinc-500",
                    localConfig.browsers.includes(b) && "bg-blue-900/30 text-blue-300 border-blue-700"
                  )}
                  onClick={() => {
                    const next = localConfig.browsers.includes(b)
                      ? localConfig.browsers.filter(x => x !== b)
                      : [...localConfig.browsers, b];
                    if (next.length > 0) setLocalConfig({ ...localConfig, browsers: next });
                  }}
                >
                  {b}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-zinc-500">Parallelism</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Switch
                  checked={localConfig.headless}
                  onCheckedChange={(v) => setLocalConfig({ ...localConfig, headless: v })}
                  className="scale-75 data-[state=checked]:bg-blue-600"
                />
                <span className="text-[10px] text-zinc-400">Headless</span>
              </div>
              <Input
                type="number"
                value={localConfig.workers}
                onChange={(e) => setLocalConfig({ ...localConfig, workers: parseInt(e.target.value) || 1 })}
                className="h-6 w-10 px-1 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
              />
              <span className="text-[10px] text-zinc-500">Workers</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-zinc-500">Viewport</Label>
            <div className="flex items-center gap-1">
              <Input
                value={localConfig.width}
                onChange={(e) => setLocalConfig({ ...localConfig, width: parseInt(e.target.value) || 1280 })}
                className="h-6 w-12 px-1 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
              />
              <span className="text-[10px] text-zinc-600">×</span>
              <Input
                value={localConfig.height}
                onChange={(e) => setLocalConfig({ ...localConfig, height: parseInt(e.target.value) || 720 })}
                className="h-6 w-12 px-1 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-zinc-500">Extra Args</Label>
            <div className="flex flex-wrap gap-1">
              {localConfig.extraArgs.length > 0 ? (
                localConfig.extraArgs.map((a, idx) => (
                  <Badge key={idx} variant="outline" className="text-[9px] px-1 py-0 border-zinc-800 bg-zinc-950 text-zinc-400">
                    {a.flag}{a.value ? `: ${a.value}` : ''}
                  </Badge>
                ))
              ) : (
                <span className="text-[10px] text-zinc-700 italic">None</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Terminal Output (Tabs multiplexer) ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-black overflow-hidden relative selection:bg-blue-500/30">

        {activeRunsList.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-800">
            <PlayIcon className="h-10 w-10 mb-4 opacity-10" />
            <p className="text-[11px] uppercase font-bold tracking-[0.2em]">
              TERMINAL READY - {targetPaths ? `(${targetPaths.length} TARGETS)` : (targetPath ? targetPath : "WORKSPACE ROOT")}
            </p>
          </div>
        )}

        {activeRunsList.length > 0 && (
          <Tabs value={activeTabId || undefined} onValueChange={setActiveTabId} className="flex-1 flex flex-col min-h-0 w-full">

            {/* Context Multi-scenario Terminal Tabs (Only show if >1 or data driven) */}
            {activeRunsList.length > 1 && (
              <div className="w-full bg-[#1e1e1e] border-b border-zinc-800 px-2 py-1.5 overflow-x-auto shrink-0 custom-scrollbar hide-scroll-arrows">
                <TabsList className="h-8 bg-transparent p-0 gap-1.5 flex justify-start items-center">
                  {activeRunsList.map(r => (
                    <TabsTrigger
                      key={r.runId}
                      value={r.runId}
                      className="px-3 py-1.5 h-full text-[11px] shadow-none data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white text-zinc-400 hover:text-zinc-200 border border-transparent data-[state=active]:border-zinc-700 transition-colors flex items-center mx-1 rounded-sm min-w-max"
                    >
                      {r.status === "running" && <Loader2Icon className="animate-spin size-3 mr-2 text-blue-400" />}
                      {r.status === "done" && r.exitCode === 0 && <CheckCircleIcon className="size-3 mr-2 text-green-500" />}
                      {r.status === "done" && r.exitCode !== 0 && <XCircleIcon className="size-3 mr-2 text-red-500" />}
                      {r.status === "error" && <XCircleIcon className="size-3 mr-2 text-red-500" />}
                      <span className="font-mono tracking-tight">{r.datasetName ? r.datasetName.replace(/[\[\]\s]/g, '') : "Default"}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            )}

            <div className="flex-1 overflow-hidden relative">
              {activeRunsList.map(r => (
                <TabsContent key={r.runId} value={r.runId} className="h-full m-0 data-[state=inactive]:hidden outline-none flex flex-col">
                  {/* The actual terminal logs */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar pb-8">
                    {r.logs.map(line => (
                      <div
                        key={line.id}
                        className={cn("whitespace-pre-wrap break-all leading-[1.6] font-mono text-[11px]", lineColor(line.type, r.exitCode))}
                        dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
                      />
                    ))}
                    <div ref={bottomRef} className="h-2" />
                  </div>
                  <div className="shrink-0 bg-[#161616] border-t border-zinc-800 py-2.5 px-4 flex items-center justify-between shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.5)] z-10 transition-all">
                    <div className="flex items-center gap-2">
                      {r.status === "running" ? (
                        <Loader2Icon className="size-5 text-blue-500 animate-spin" />
                      ) : r.exitCode === 0 ? (
                        <CheckCircleIcon className="size-5 text-green-500 animate-in zoom-in" />
                      ) : (
                        <XCircleIcon className="size-5 text-red-500 animate-in zoom-in" />
                      )}
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        r.status === "running" ? "text-blue-500" :
                          r.exitCode === 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {r.status === "running" ? "Executing..." :
                          r.exitCode === 0 ? "Execution Successful" : "Execution Failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline" size="sm"
                        disabled={r.status === "running"}
                        className="h-7 text-[10px] bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 uppercase font-bold tracking-wider"
                        onClick={() => window.open(apiClient.getReportUrl(projectId, r.runId, 'html'), '_blank')}
                      >
                        <ExternalLinkIcon className="h-3 w-3 mr-1.5 opacity-70" /> HTML Report
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={r.status === "running"}
                        className="h-7 text-[10px] bg-blue-900/40 border-blue-800/50 text-blue-300 hover:text-white hover:bg-blue-800/80 uppercase font-bold tracking-wider"
                        onClick={() => window.open(apiClient.getReportUrl(projectId, r.runId, 'monocart'), '_blank')}
                      >
                        <ExternalLinkIcon className="h-3 w-3 mr-1.5 opacity-70" /> Monocart Report
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>

          </Tabs>
        )}
      </div>
    </div>
  );
}
