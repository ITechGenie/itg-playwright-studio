"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { XIcon, PlayIcon, RotateCcwIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const WS_URL = "ws://localhost:3000";
const API_URL = "http://localhost:3000";

// Simple ANSI to HTML converter
function ansiToHtml(text: string): string {
  const ansiColors: Record<string, string> = {
    '30': '#000000', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
    '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#d1d5db',
    '90': '#6b7280', '91': '#f87171', '92': '#4ade80', '93': '#fbbf24',
    '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#f3f4f6',
  };

  // First escape HTML
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Then convert ANSI color codes to HTML spans
  result = result.replace(/\x1b\[([0-9;]+)m/g, (_match, codes) => {
    const codeList = codes.split(';');
    
    // Reset code
    if (codeList.includes('0') || codes === '') {
      return '</span>';
    }
    
    // Find color code
    const colorCode = codeList.find((code: string) => ansiColors[code]);
    if (colorCode && ansiColors[colorCode]) {
      return `<span style="color: ${ansiColors[colorCode]}">`;
    }
    
    return '';
  });

  return result;
}

export interface TestRunnerPanelProps {
  projectId: string;
  /** Relative path to a file or folder. Empty = root (run all). */
  targetPath?: string;
  /** Existing run ID to attach to */
  initialRunId?: string;
  onClose?: () => void;
  showNewTab?: boolean;
  /** Browser to use for tests */
  browser?: string;
  /** Viewport width */
  width?: number;
  /** Viewport height */
  height?: number;
  /** Base URL for tests */
  baseURL?: string;
  /** Video recording mode */
  video?: string;
  /** Screenshot mode */
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
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogLine["type"], text: string) => {
    setLogs(prev => [...prev, { id: _lineSeq++, type, text }]);
  }, []);

  // ── Fetch existing logs if attaching to a run ────────────────────────────
  useEffect(() => {
    if (initialRunId) {
      fetch(`${API_URL}/api/projects/${projectId}/run/${initialRunId}`)
        .then(res => res.json())
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

  // Auto-scroll to bottom on new log lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── WebSocket connection ─────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
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
      const body: Record<string, unknown> = {
        path: targetPath,
        headless,
        workers: parseInt(workers) || 1,
        browser,
        width,
        height,
        baseURL,
        video,
        screenshot,
      };
      if (grep) body.grep = grep;

      const res = await fetch(`${API_URL}/api/projects/${projectId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        addLog("error", `Failed to start run: ${err.error}`);
        setRunning(false);
        return;
      }

      const data = await res.json();
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
      ? <Badge className="bg-green-600 text-white">Passed</Badge>
      : <Badge variant="destructive">Failed (exit {exitCode})</Badge>;
  };

  const lineColor = (type: LogLine["type"]) => {
    switch (type) {
      case "stderr": return "text-red-400";
      case "info":   return "text-blue-300";
      case "done":   return exitCode === 0 ? "text-green-400" : "text-red-400";
      case "error":  return "text-red-500 font-bold";
      default:       return "text-gray-200";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-sm font-mono rounded-t-lg border border-zinc-700 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0 flex-wrap gap-y-2">
        <span className="text-zinc-300 font-semibold truncate max-w-[200px]">
          {targetPath || "All tests"} {statusBadge()}
        </span>
        <div className="flex items-center gap-1.5">
          <Switch
            id="headless-toggle"
            checked={headless}
            onCheckedChange={setHeadless}
            disabled={running}
            className="scale-75"
          />
          <Label htmlFor="headless-toggle" className="text-zinc-400 text-xs">Headless</Label>
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-zinc-400 text-xs">Workers</Label>
          <Input
            value={workers}
            onChange={e => setWorkers(e.target.value)}
            disabled={running}
            className="h-6 w-12 px-1.5 text-xs bg-zinc-800 border-zinc-600 text-zinc-200"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-zinc-400 text-xs">Grep</Label>
          <Input
            value={grep}
            onChange={e => setGrep(e.target.value)}
            placeholder="regex…"
            disabled={running}
            className="h-6 w-28 px-1.5 text-xs bg-zinc-800 border-zinc-600 text-zinc-200"
          />
        </div>
        <div className="flex-1" />
        {showNewTab && runId && (
          <Button
            size="sm" variant="ghost"
            onClick={() => window.open(`/app/project/${projectId}/run/${runId}`, '_blank')}
            className="h-7 text-xs text-zinc-400 hover:text-white gap-1"
            title="Open in new tab"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={() => setLogs([])}
          disabled={running}
          className="h-7 text-xs text-zinc-400 hover:text-white"
          title="Clear output"
        >
          <RotateCcwIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className={cn("h-7 text-xs gap-1.5", running ? "bg-zinc-700" : "bg-green-700 hover:bg-green-600")}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {running ? "Running…" : "Run"}
        </Button>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0 text-zinc-500 hover:text-white">
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Terminal Output ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {logs.length === 0 && !running && (
          <p className="text-zinc-600 text-xs mt-4 text-center">
            Press <span className="text-zinc-400">Run</span> to execute tests
            {targetPath ? ` in "${targetPath}"` : " (all)"}
          </p>
        )}
        {logs.map(line => (
          <div 
            key={line.id} 
            className={cn("whitespace-pre-wrap break-all leading-5 font-mono text-xs", lineColor(line.type))}
            dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
