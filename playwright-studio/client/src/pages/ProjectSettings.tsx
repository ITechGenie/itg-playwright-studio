import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SaveIcon, PlusIcon, XIcon, Loader2Icon, CheckCircleIcon, SettingsIcon } from "lucide-react"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

// Whitelisted Playwright CLI flags — must match server-side ALLOWED_PLAYWRIGHT_FLAGS
const PLAYWRIGHT_CLI_OPTIONS = [
  { flag: "--block-service-workers", description: "Block service workers", hasValue: false },
  { flag: "--channel", description: "Browser channel (chrome, chrome-beta, msedge-dev, etc.)", hasValue: true },
  { flag: "--color-scheme", description: "Emulate color scheme (light or dark)", hasValue: true },
  { flag: "--device", description: "Emulate device (e.g. iPhone 11)", hasValue: true },
  { flag: "--geolocation", description: "Geolocation coordinates (e.g. 37.8,-122.4)", hasValue: true },
  { flag: "--ignore-https-errors", description: "Ignore HTTPS errors", hasValue: false },
  { flag: "--lang", description: "Language/locale (e.g. en-GB)", hasValue: true },
  { flag: "--proxy-server", description: "Proxy server URL", hasValue: true },
  { flag: "--proxy-bypass", description: "Comma-separated domains to bypass proxy", hasValue: true },
  { flag: "--timezone", description: "Timezone to emulate (e.g. Europe/London)", hasValue: true },
  { flag: "--timeout", description: "Timeout for Playwright actions (ms)", hasValue: true },
  { flag: "--user-agent", description: "Custom user agent string", hasValue: true },
  { flag: "--user-data-dir", description: "Custom user data directory", hasValue: true },
  { flag: "--viewport-size", description: "Viewport size (e.g. 1280,720)", hasValue: true },
  { flag: "--save-har", description: "Save HAR file path", hasValue: true },
  { flag: "--save-har-glob", description: "Filter HAR entries by URL glob", hasValue: true },
  { flag: "--save-storage", description: "Save context storage state path", hasValue: true },
  { flag: "--load-storage", description: "Load context storage state from file", hasValue: true },
]

const BROWSER_OPTIONS = [
  { value: "chromium", label: "Chromium" },
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "webkit", label: "WebKit" },
  { value: "edge", label: "Edge" },
]

interface ExtraArg {
  flag: string;
  value: string;
}

export default function ProjectSettings() {
  const { id: projectId } = useParams<{ id: string }>()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Run config state
  const [browsers, setBrowsers] = useState<string[]>(["chromium"])
  const [headless, setHeadless] = useState(true)
  const [workers, setWorkers] = useState("1")
  const [width, setWidth] = useState("1280")
  const [height, setHeight] = useState("720")
  const [baseURL, setBaseURL] = useState("http://localhost:5173")
  const [video, setVideo] = useState("retain-on-failure")
  const [screenshot, setScreenshot] = useState("only-on-failure")
  const [timeout, setTimeout_] = useState("30000")
  const [extraArgs, setExtraArgs] = useState<ExtraArg[]>([])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient.getProjects().then((projects: any[]) => {
      const proj = projects.find(p => p.id === projectId)
      if (proj?.config) {
        const c = proj.config
        setBrowsers(c.browsers ? (typeof c.browsers === 'string' ? JSON.parse(c.browsers) : c.browsers) : [c.browser || "chromium"])
        setHeadless(c.headless !== undefined ? !!c.headless : true)
        setWorkers(String(c.workers || 1))
        setWidth(String(c.viewportWidth || 1280))
        setHeight(String(c.viewportHeight || 720))
        setBaseURL(c.baseUrl || "http://localhost:5173")
        setVideo(c.video || "retain-on-failure")
        setScreenshot(c.screenshot || "only-on-failure")
        setTimeout_(String(c.timeout || 30000))
        setExtraArgs(c.extraArgs ? (typeof c.extraArgs === 'string' ? JSON.parse(c.extraArgs) : c.extraArgs) : [])
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
        baseUrl: baseURL,
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Viewport Width</Label>
                  <Input type="number" value={width} onChange={e => setWidth(e.target.value)} className="h-10 bg-zinc-900 border-zinc-800 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Viewport Height</Label>
                  <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-10 bg-zinc-900 border-zinc-800 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-zinc-400">Base URL</Label>
                <Input value={baseURL} onChange={e => setBaseURL(e.target.value)} placeholder="http://localhost:5173" className="h-10 bg-zinc-900 border-zinc-800 text-sm" />
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

          <div className="flex justify-end gap-3 pb-8">
            {saved && <span className="text-green-500 text-xs font-bold flex items-center gap-1.5"><CheckCircleIcon className="h-4 w-4" /> Saved</span>}
            <Button size="lg" className="px-10 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><SaveIcon className="h-4 w-4 mr-2" /> Save Settings</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
