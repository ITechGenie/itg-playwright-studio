import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SaveIcon, PlusIcon, XIcon, Loader2Icon, CheckCircleIcon, RefreshCwIcon, GitBranchIcon, FolderIcon, Edit2Icon } from "lucide-react"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { PLAYWRIGHT_CLI_OPTIONS, BROWSER_OPTIONS } from "@/lib/playwright-options"
import { GitUrlParser } from "@/lib/git-url-parser"
import { ViewportPicker } from "@/components/viewport-picker"

interface ExtraArg {
  flag: string;
  value: string;
}

export default function ProjectSettings() {
  const { id: projectId } = useParams<{ id: string }>()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Project data
  const [repoUrl, setRepoUrl] = useState<string | null>(null)

  // Git config state
  const [gitEditMode, setGitEditMode] = useState(false)
  const [gitRepoUrl, setGitRepoUrl] = useState("")
  const [gitBranch, setGitBranch] = useState("")
  const [gitPath, setGitPath] = useState("")
  const [gitProvider, setGitProvider] = useState<'github' | 'gitlab'>('github')
  const [gitError, setGitError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; filesDownloaded?: number; error?: string } | null>(null)

  // Run config state
  const [browsers, setBrowsers] = useState<string[]>(["chromium"])
  const [headless, setHeadless] = useState(true)
  const [workers, setWorkers] = useState("1")
  const [width, setWidth] = useState("1280")
  const [height, setHeight] = useState("720")
  const [video, setVideo] = useState("retain-on-failure")
  const [screenshot, setScreenshot] = useState("only-on-failure")
  const [timeout, setTimeout_] = useState("30000")
  const [extraArgs, setExtraArgs] = useState<ExtraArg[]>([])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient.getProjects().then((projects: any[]) => {
      const proj = projects.find(p => p.id === projectId)
      if (proj) {
        setRepoUrl(proj.repoUrl || null)
        
        // Parse Git URL if present
        if (proj.repoUrl) {
          try {
            const parsed = GitUrlParser.parse(proj.repoUrl)
            setGitProvider(parsed.provider)
            setGitRepoUrl(parsed.repoUrl)
            setGitBranch(parsed.branch)
            setGitPath(parsed.folderPath)
          } catch (err) {
            console.error("Failed to parse Git URL:", err)
          }
        }

        if (proj.config) {
          const c = proj.config
          setBrowsers(c.browsers ? (typeof c.browsers === 'string' ? JSON.parse(c.browsers) : c.browsers) : [c.browser || "chromium"])
          setHeadless(c.headless !== undefined ? !!c.headless : true)
          setWorkers(String(c.workers || 1))
          setWidth(String(c.viewportWidth || 1280))
          setHeight(String(c.viewportHeight || 720))
          setVideo(c.video || "retain-on-failure")
          setScreenshot(c.screenshot || "only-on-failure")
          setTimeout_(String(c.timeout || 30000))
          setExtraArgs(c.extraArgs ? (typeof c.extraArgs === 'string' ? JSON.parse(c.extraArgs) : c.extraArgs) : [])
        }
      }
    }).finally(() => setLoading(false))
  }, [projectId])

  const toggleBrowser = (browser: string) => {
    setBrowsers(prev => {
      if (prev.includes(browser)) {
        if (prev.length === 1) return prev // keep at least one
        return prev.filter(b => b !== browser)
      }
      return [...prev, browser]
    })
  }

  const addExtraArg = () => {
    setExtraArgs(prev => [...prev, { flag: "", value: "" }])
  }

  const removeExtraArg = (index: number) => {
    setExtraArgs(prev => prev.filter((_, i) => i !== index))
  }

  const updateExtraArg = (index: number, field: "flag" | "value", val: string) => {
    setExtraArgs(prev => prev.map((arg, i) => i === index ? { ...arg, [field]: val } : arg))
  }

  const handleSave = async () => {
    if (!projectId) return
    setSaving(true)
    setSaved(false)
    try {
      await apiClient.updateProjectConfig(projectId, {
        browser: browsers[0],
        browsers,
        headless,
        workers: parseInt(workers),
        viewportWidth: parseInt(width),
        viewportHeight: parseInt(height),
        video,
        screenshot,
        timeout: parseInt(timeout),
        extraArgs: extraArgs.filter(a => a.flag),
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error("Failed to save config", err)
    } finally {
      setSaving(false)
    }
  }

  const handleEditGitConfig = () => {
    setGitEditMode(true)
    setGitError(null)
  }

  const handleCancelGitEdit = () => {
    setGitEditMode(false)
    setGitError(null)
    // Reset to original values
    if (repoUrl) {
      try {
        const parsed = GitUrlParser.parse(repoUrl)
        setGitProvider(parsed.provider)
        setGitRepoUrl(parsed.repoUrl)
        setGitBranch(parsed.branch)
        setGitPath(parsed.folderPath)
      } catch (err) {
        console.error("Failed to parse Git URL:", err)
      }
    }
  }

  const handleSaveGitConfig = async () => {
    if (!projectId) return
    setGitError(null)

    try {
      // Reconstruct URL from parts
      const reconstructed = GitUrlParser.reconstruct({
        provider: gitProvider,
        repoOwner: gitRepoUrl.split('/').slice(-2, -1)[0] || '',
        repoName: gitRepoUrl.split('/').slice(-1)[0] || '',
        branch: gitBranch,
        folderPath: gitPath,
        repoUrl: gitRepoUrl,
      })

      // Validate reconstructed URL
      if (!GitUrlParser.validate(reconstructed)) {
        setGitError('Invalid Git URL configuration')
        return
      }

      await apiClient.updateProjectGitConfig(projectId, reconstructed)
      setRepoUrl(reconstructed)
      setGitEditMode(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setGitError(err.message || 'Failed to update Git configuration')
    }
  }

  const handleSyncFromGit = async () => {
    if (!projectId) return
    setSyncing(true)
    setSyncResult(null)

    try {
      const result = await apiClient.syncProjectFromGit(projectId)
      setSyncResult({
        success: true,
        filesDownloaded: result.filesDownloaded || 0,
      })
      window.setTimeout(() => setSyncResult(null), 5000)
    } catch (err: any) {
      setSyncResult({
        success: false,
        error: err.message || 'Failed to sync from Git',
      })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title="Run Configuration" 
        description="Default execution settings for this project. These can be overridden per-run in the runner panel."
      />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl w-full mx-auto p-6 space-y-6">
          {/* Git Repository */}
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Git Repository</CardTitle>
                <CardDescription className="text-xs">Configure Git integration for this project</CardDescription>
              </div>
              {repoUrl && !gitEditMode && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 border-zinc-700 hover:bg-zinc-800"
                  onClick={handleEditGitConfig}
                >
                  <Edit2Icon className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!repoUrl && !gitEditMode ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  <GitBranchIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No Git repository configured</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 border-zinc-700 hover:bg-zinc-800"
                    onClick={handleEditGitConfig}
                  >
                    <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Git Configuration
                  </Button>
                </div>
              ) : gitEditMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-zinc-400">Provider</Label>
                    <Select value={gitProvider} onValueChange={(val: 'github' | 'gitlab') => setGitProvider(val)}>
                      <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-zinc-400">Repository URL</Label>
                    <Input 
                      placeholder="https://github.com/owner/repo" 
                      value={gitRepoUrl} 
                      onChange={e => setGitRepoUrl(e.target.value)}
                      className="h-10 bg-zinc-900 border-zinc-800 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">
                        <GitBranchIcon className="h-3 w-3 inline mr-1" />
                        Branch
                      </Label>
                      <Input 
                        placeholder="main" 
                        value={gitBranch} 
                        onChange={e => setGitBranch(e.target.value)}
                        className="h-10 bg-zinc-900 border-zinc-800 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">
                        <FolderIcon className="h-3 w-3 inline mr-1" />
                        Folder Path
                      </Label>
                      <Input 
                        placeholder="tests (optional)" 
                        value={gitPath} 
                        onChange={e => setGitPath(e.target.value)}
                        className="h-10 bg-zinc-900 border-zinc-800 text-sm"
                      />
                    </div>
                  </div>
                  {gitError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-3">
                      {gitError}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-500"
                      onClick={handleSaveGitConfig}
                    >
                      <SaveIcon className="h-3.5 w-3.5 mr-1" /> Save Git Config
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800"
                      onClick={handleCancelGitEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="text-xs text-zinc-500 uppercase font-bold">Repository</div>
                      <div className="text-sm text-zinc-300 font-mono bg-zinc-900/50 px-3 py-2 rounded border border-zinc-800">
                        {gitRepoUrl}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase font-bold mb-1">
                        <GitBranchIcon className="h-3 w-3 inline mr-1" />
                        Branch
                      </div>
                      <div className="text-sm text-zinc-300 font-mono bg-zinc-900/50 px-3 py-2 rounded border border-zinc-800">
                        {gitBranch}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 uppercase font-bold mb-1">
                        <FolderIcon className="h-3 w-3 inline mr-1" />
                        Folder Path
                      </div>
                      <div className="text-sm text-zinc-300 font-mono bg-zinc-900/50 px-3 py-2 rounded border border-zinc-800">
                        {gitPath || '/'}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800"
                      onClick={handleSyncFromGit}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <><Loader2Icon className="h-3.5 w-3.5 mr-1 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCwIcon className="h-3.5 w-3.5 mr-1" /> Sync from Git</>
                      )}
                    </Button>
                    {syncResult && (
                      <span className={cn(
                        "ml-3 text-xs font-bold",
                        syncResult.success ? "text-green-500" : "text-red-400"
                      )}>
                        {syncResult.success 
                          ? `✓ Synced ${syncResult.filesDownloaded} files`
                          : `✗ ${syncResult.error}`
                        }
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Browsers */}
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Browsers</CardTitle>
              <CardDescription className="text-xs">Select one or more browsers. Tests will execute natively across all selected browsers using Playwright's <code className="bg-zinc-800 px-1 rounded text-blue-400">--project</code> flag.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {BROWSER_OPTIONS.map(b => (
                  <button
                    key={b.value}
                    onClick={() => toggleBrowser(b.value)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                      browsers.includes(b.value)
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Core Settings */}
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Execution Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-400">Headless Mode</Label>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Run without browser UI</p>
                  </div>
                  <Switch checked={headless} onCheckedChange={setHeadless} className="data-[state=checked]:bg-blue-600" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Workers</Label>
                  <Input type="number" min="1" max="16" value={workers} onChange={e => setWorkers(e.target.value)} className="h-10 bg-zinc-900 border-zinc-800 text-sm focus:ring-blue-500" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Viewport</Label>
                  <ViewportPicker size="full" currentW={parseInt(width)} currentH={parseInt(height)}
                    onSelect={(w, h) => { setWidth(String(w)); setHeight(String(h)) }} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <Input type="number" value={width} onChange={e => setWidth(e.target.value)}
                    className="h-10 bg-zinc-900 border-zinc-800 text-sm" placeholder="Width" />
                  <Input type="number" value={height} onChange={e => setHeight(e.target.value)}
                    className="h-10 bg-zinc-900 border-zinc-800 text-sm" placeholder="Height" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-zinc-400">Timeout (ms)</Label>
                <Input type="number" value={timeout} onChange={e => setTimeout_(e.target.value)} className="h-10 bg-zinc-900 border-zinc-800 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Video Recording</Label>
                  <Select value={video} onValueChange={setVideo}>
                    <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="on">On</SelectItem><SelectItem value="retain-on-failure">On Failure</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Screenshots</Label>
                  <Select value={screenshot} onValueChange={setScreenshot}>
                    <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="on">On</SelectItem><SelectItem value="only-on-failure">On Failure</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Extra Args */}
          <Card className="border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Advanced CLI Options</CardTitle>
              <Button variant="outline" size="sm" className="h-8 border-zinc-700 hover:bg-zinc-800" onClick={addExtraArg}><PlusIcon className="h-3.5 w-3.5 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {extraArgs.map((arg, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={arg.flag} onValueChange={(val) => updateExtraArg(i, "flag", val)}>
                    <SelectTrigger className="h-10 flex-1 bg-zinc-900 border-zinc-800 text-xs"><SelectValue placeholder="Option..." /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      {PLAYWRIGHT_CLI_OPTIONS.map(opt => <SelectItem key={opt.flag} value={opt.flag} className="text-xs">{opt.flag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Value..." value={arg.value} onChange={e => updateExtraArg(i, "value", e.target.value)} className="h-10 flex-1 bg-zinc-900 border-zinc-800 text-xs" />
                  <Button variant="ghost" size="icon" onClick={() => removeExtraArg(i)} className="h-10 w-10 text-zinc-600 hover:text-red-400 hover:bg-red-500/10"><XIcon className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center gap-6 pb-20 pt-4 border-t border-zinc-900">
            <Button 
              size="lg" 
              className="px-10 h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/10" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? (
                <><Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><SaveIcon className="h-4 w-4 mr-2" /> Save Settings</>
              )}
            </Button>
            {saved && (
              <span className="text-green-500 text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                <CheckCircleIcon className="size-4" /> 
                Configuration Saved Successfully
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
