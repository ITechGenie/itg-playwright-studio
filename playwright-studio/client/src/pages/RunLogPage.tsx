import { useParams, useNavigate } from "react-router-dom"
import { TestRunnerPanel } from "@/components/test-runner-panel"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"

export default function RunLogPage() {
  const { id: projectId, runId } = useParams()
  const navigate = useNavigate()

  if (!projectId || !runId) return <div>Invalid Run ID</div>

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* ── Minimal Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Studio
          </Button>
          <h1 className="text-zinc-200 font-semibold tracking-tight">
            Run Logs: <span className="text-zinc-500 font-mono text-sm">{runId}</span>
          </h1>
        </div>
      </div>

      {/* ── Test Runner Panel (Full Screen) ── */}
      <div className="flex-1 overflow-hidden">
        <TestRunnerPanel 
          projectId={projectId} 
          initialRunId={runId}
          showNewTab={false}
          runConfig={{
            browsers: ['chromium'],
            headless: true,
            workers: 1,
            width: 1280,
            height: 720,
            video: 'retain-on-failure',
            screenshot: 'only-on-failure',
            timeout: 30000,
            extraArgs: [],
          }}
        />
      </div>
    </div>
  )
}
