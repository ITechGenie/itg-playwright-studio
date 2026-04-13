import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { FileManager } from "@/components/file-manager"
import { TestRunnerPanel } from "@/components/test-runner-panel"
import { ScheduleDrawer } from "@/components/schedule-drawer"
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Wand2Icon, Settings2Icon, PlusIcon, CalendarClockIcon, GitBranchIcon } from "lucide-react"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { type RunConfig } from "@/components/config-panel"

// RunConfig for the existing TestRunnerPanel (includes extraArgs which ConfigPanel omits)
interface LegacyRunConfig extends RunConfig {
  baseURL: string;
  extraArgs: { flag: string; value: string }[];
}

const DEFAULT_CONFIG: LegacyRunConfig = {
  browsers: ["chromium"],
  headless: true,
  workers: 1,
  width: 1280,
  height: 720,
  baseURL: "http://localhost:5173",
  video: "retain-on-failure",
  screenshot: "only-on-failure",
  timeout: 30000,
  extraArgs: [],
}

export default function TestSpecs() {
  const { id: projectId } = useParams<{ id: string }>()
  const params = useParams()
  const splatPath: string = (params as any)["*"] || ""
  const navigate = useNavigate()

  const [runnerTarget, setRunnerTarget] = useState<string | undefined>(undefined)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [runConfig, setRunConfig] = useState<LegacyRunConfig>(DEFAULT_CONFIG)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [projectRepoUrl, setProjectRepoUrl] = useState<string | null>(null)

  // Add Spec dialog state
  const [createSpecDialogOpen, setCreateSpecDialogOpen] = useState(false)
  const [specFilenameInput, setSpecFilenameInput] = useState("example.spec.ts")
  const [addSpecDialogOpen, setAddSpecDialogOpen] = useState(false)
  const [newSpecName, setNewSpecName] = useState("")
  const [addSpecCommitMsg, setAddSpecCommitMsg] = useState("")

  useEffect(() => {
    if (!projectId) return
    apiClient.getProjects().then((projects: any[]) => {
      const proj = projects.find(p => p.id === projectId)
      if (proj?.config) {
        const c = proj.config
        setRunConfig({
          browsers: c.browsers
            ? (typeof c.browsers === 'string' ? JSON.parse(c.browsers) : c.browsers)
            : [c.browser || "chromium"],
          headless: c.headless !== undefined ? !!c.headless : true,
          workers: c.workers || 1,
          width: c.viewportWidth || 1280,
          height: c.viewportHeight || 720,
          baseURL: c.baseUrl || "http://localhost:5173",
          video: c.video || "retain-on-failure",
          screenshot: c.screenshot || "only-on-failure",
          timeout: c.timeout || 30000,
          extraArgs: c.extraArgs
            ? (typeof c.extraArgs === 'string' ? JSON.parse(c.extraArgs) : c.extraArgs)
            : [],
        })
      }
      setProjectRepoUrl(proj?.repoUrl ?? null)
    })
  }, [projectId])

  const openRunner = (target: string) => setRunnerTarget(target)
  const closeRunner = () => setRunnerTarget(undefined)

  const handleCreateSpecClick = () => {
    setSpecFilenameInput("example.spec.ts")
    setCreateSpecDialogOpen(true)
  }

  const handleCreateSpecProceed = async () => {
    const filename = specFilenameInput.trim()
    if (!filename) return
    setCreateSpecDialogOpen(false)
    
    // Prefix current sub-directory path
    const fullPath = splatPath ? `${splatPath}/${filename}` : filename;
    
    if (projectRepoUrl) {
      setNewSpecName(fullPath)
      setAddSpecCommitMsg("")
      setAddSpecDialogOpen(true)
    } else {
      try {
        await apiClient.createFileContent(projectId!, fullPath, "import { test, expect } from '@playwright/test';\n\ntest('New test', async ({ page }) => {\n  \n});\n")
        window.location.reload()
      } catch (e) {
        alert("Failed to create spec")
      }
    }
  }

  const handleAddSpecConfirm = async (commitMsg?: string) => {
    setAddSpecDialogOpen(false)
    try {
      await apiClient.createFileContent(
        projectId!,
        newSpecName,
        "import { test, expect } from '@playwright/test';\n\ntest('New test', async ({ page }) => {\n  \n});\n",
        commitMsg
      )
      window.location.reload()
    } catch (e) {
      alert("Failed to create spec")
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PageHeader
        title="User Journeys"
        description="Explore and execute your Playwright test specifications. Select multiple files to run them in bulk."
        action={
          <div className="flex items-center gap-3">
            {projectRepoUrl && (
              <Badge variant="outline" className="h-8 gap-1.5 border-zinc-700 text-zinc-400 text-xs font-medium px-3">
                <GitBranchIcon className="h-3.5 w-3.5 text-blue-400" />
                Git
              </Badge>
            )}
            <Button
              variant="outline" 
              size="lg" 
              className="h-11 border-zinc-800 bg-zinc-900 text-zinc-400 font-bold px-4 hover:text-white"
              onClick={() => navigate(`/app/project/${projectId}/settings/run`)}
              title="Go to Run Configuration settings"
            >
              <Settings2Icon className="mr-2 h-4 w-4" />
              Config
            </Button>

            <Button
              size="lg"
              className="h-11 gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold px-6 shadow-lg shadow-purple-900/20"
              onClick={() => setScheduleDrawerOpen(true)}
            >
              <CalendarClockIcon className="h-5 w-5" />
              Schedule Test
            </Button>

            <Button
              size="lg"
              className="h-11 gap-2 bg-green-700 hover:bg-green-600 text-white font-bold px-8 shadow-lg shadow-green-900/20"
              onClick={() => openRunner(selectedPaths.length > 0 ? "SELECTED" : "")}
            >
              <Wand2Icon className="h-5 w-5" />
              {selectedPaths.length > 0 ? `Prepare Tests (${selectedPaths.length})` : "Prepare Tests"}
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden p-6 pt-2">
        <FileManager
          title="Scripts explorer"
          onRunFile={openRunner}
          onSelectionChange={setSelectedPaths}
          actions={
            <Button
              variant="outline" 
              size="sm" 
              className="h-8 text-xs font-semibold border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800"
              onClick={handleCreateSpecClick}
            >
              <PlusIcon className="size-3.5 mr-1.5" /> Add Spec
            </Button>
          }
        />
      </div>

      <Drawer
        open={runnerTarget !== undefined}
        onOpenChange={(open) => !open && closeRunner()}
        direction="right"
        dismissible={false}
        modal={false}
      >
        <DrawerContent className="w-[95vw] sm:max-w-none">
          <DrawerTitle className="sr-only">Test Runner</DrawerTitle>
          <DrawerDescription className="sr-only">
            Live output from the Playwright test execution.
          </DrawerDescription>
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            {runnerTarget !== undefined && projectId && (
              <TestRunnerPanel
                projectId={projectId}
                targetPath={runnerTarget === "SELECTED" ? undefined : runnerTarget}
                targetPaths={runnerTarget === "SELECTED" ? selectedPaths : undefined}
                onClose={closeRunner}
                runConfig={runConfig}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {projectId && (
        <ScheduleDrawer
          projectId={projectId}
          open={scheduleDrawerOpen}
          onOpenChange={setScheduleDrawerOpen}
          targetPaths={selectedPaths}
          initialConfig={runConfig}
        />
      )}

      <Dialog open={createSpecDialogOpen} onOpenChange={setCreateSpecDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Spec</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="spec-filename" className="text-xs font-bold uppercase text-zinc-400">File Name</Label>
            <Input
              id="spec-filename"
              placeholder="e.g. example.spec.ts"
              value={specFilenameInput}
              onChange={(e) => setSpecFilenameInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateSpecDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!specFilenameInput.trim()} onClick={handleCreateSpecProceed}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSpecDialogOpen} onOpenChange={setAddSpecDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Push New Spec to Git</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-zinc-400">Creating <span className="font-mono text-zinc-200">{newSpecName}</span></p>
            <Label htmlFor="add-spec-commit" className="text-xs font-bold uppercase text-zinc-400">Commit Message</Label>
            <Input
              id="add-spec-commit"
              placeholder="e.g. Add new test spec"
              value={addSpecCommitMsg}
              onChange={(e) => setAddSpecCommitMsg(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleAddSpecConfirm()}>
              Save Locally Only
            </Button>
            <Button disabled={!addSpecCommitMsg.trim()} onClick={() => handleAddSpecConfirm(addSpecCommitMsg.trim())}>
              <GitBranchIcon className="h-3.5 w-3.5 mr-1.5" /> Save & Push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
