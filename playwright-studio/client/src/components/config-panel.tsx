import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type RunConfig = {
  browsers: string[]
  headless: boolean
  workers: number
  width: number
  height: number
  baseURL: string
  video: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry'
  screenshot: 'off' | 'on' | 'only-on-failure'
  timeout: number
  envId?: string
  dataSetIds?: string[]
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  browsers: ['chromium'],
  headless: true,
  workers: 1,
  width: 1280,
  height: 720,
  baseURL: 'http://localhost:5173',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
  timeout: 30000,
}

export type ConfigPanelProps = {
  value: RunConfig
  onChange: (config: RunConfig) => void
  disabled?: boolean
  compact?: boolean
}

const BROWSERS = ['chromium', 'firefox', 'webkit', 'chrome', 'msedge'] as const

export function ConfigPanel({ value, onChange, disabled = false, compact = false }: ConfigPanelProps) {
  const set = <K extends keyof RunConfig>(key: K, val: RunConfig[K]) =>
    onChange({ ...value, [key]: val })

  const toggleBrowser = (b: string) => {
    const next = value.browsers.includes(b)
      ? value.browsers.filter(x => x !== b)
      : [...value.browsers, b]
    if (next.length > 0) set('browsers', next)
  }

  const labelCls = "text-[11px] uppercase font-bold text-muted-foreground tracking-wide"
  const inputCls = "h-8 text-sm bg-background border-border"

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-2">
        {/* Browsers */}
        <div className="flex items-center gap-1.5">
          <span className={cn(labelCls, "text-[10px]")}>Browsers</span>
          <div className="flex gap-1">
            {BROWSERS.map(b => (
              <Badge
                key={b}
                variant="outline"
                onClick={() => !disabled && toggleBrowser(b)}
                className={cn(
                  "cursor-pointer text-[9px] px-1.5 py-0 capitalize border-border",
                  value.browsers.includes(b) && "bg-blue-900/30 text-blue-300 border-blue-700",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >{b}</Badge>
            ))}
          </div>
        </div>
        {/* Headless */}
        <div className="flex items-center gap-1.5">
          <Switch checked={value.headless} onCheckedChange={v => !disabled && set('headless', v)} disabled={disabled} className="scale-75 data-[state=checked]:bg-blue-600" />
          <span className="text-[10px] text-muted-foreground">Headless</span>
        </div>
        {/* Workers */}
        <div className="flex items-center gap-1.5">
          <span className={cn(labelCls, "text-[10px]")}>Workers</span>
          <Input type="number" min={1} max={16} value={value.workers} disabled={disabled}
            onChange={e => set('workers', parseInt(e.target.value) || 1)}
            className="h-6 w-10 px-1 text-[10px] bg-background border-border" />
        </div>
        {/* Viewport */}
        <div className="flex items-center gap-1">
          <Input value={value.width} disabled={disabled} onChange={e => set('width', parseInt(e.target.value) || 1280)}
            className="h-6 w-14 px-1 text-[10px] bg-background border-border" />
          <span className="text-[10px] text-muted-foreground">×</span>
          <Input value={value.height} disabled={disabled} onChange={e => set('height', parseInt(e.target.value) || 720)}
            className="h-6 w-14 px-1 text-[10px] bg-background border-border" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Browsers */}
      <div className="space-y-2">
        <Label className={labelCls}>Browsers</Label>
        <div className="flex flex-wrap gap-2">
          {BROWSERS.map(b => (
            <Badge
              key={b}
              variant="outline"
              onClick={() => !disabled && toggleBrowser(b)}
              className={cn(
                "cursor-pointer text-xs px-3 py-1 capitalize border-border transition-colors",
                value.browsers.includes(b)
                  ? "bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50"
                  : "text-muted-foreground hover:text-foreground hover:border-border",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >{b}</Badge>
          ))}
        </div>
      </div>

      {/* Execution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={labelCls}>Mode</Label>
          <div className="flex items-center gap-2 h-8">
            <Switch
              checked={value.headless}
              onCheckedChange={v => !disabled && set('headless', v)}
              disabled={disabled}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className="text-sm text-muted-foreground">{value.headless ? 'Headless' : 'Headed'}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>Workers</Label>
          <Input
            type="number" min={1} max={16}
            value={value.workers}
            disabled={disabled}
            onChange={e => set('workers', Math.min(16, Math.max(1, parseInt(e.target.value) || 1)))}
            className={inputCls}
          />
        </div>
      </div>

      {/* Viewport */}
      <div className="space-y-2">
        <Label className={labelCls}>Viewport</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number" placeholder="Width"
            value={value.width}
            disabled={disabled}
            onChange={e => set('width', parseInt(e.target.value) || 1280)}
            className={cn(inputCls, "flex-1")}
          />
          <span className="text-muted-foreground text-sm">×</span>
          <Input
            type="number" placeholder="Height"
            value={value.height}
            disabled={disabled}
            onChange={e => set('height', parseInt(e.target.value) || 720)}
            className={cn(inputCls, "flex-1")}
          />
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <Label className={labelCls}>Base URL</Label>
        <Input
          value={value.baseURL}
          disabled={disabled}
          onChange={e => set('baseURL', e.target.value)}
          placeholder="http://localhost:5173"
          className={inputCls}
        />
      </div>

      {/* Video & Screenshot */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={labelCls}>Video</Label>
          <Select value={value.video} onValueChange={v => !disabled && set('video', v as RunConfig['video'])} disabled={disabled}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="on">Always</SelectItem>
              <SelectItem value="retain-on-failure">On Failure</SelectItem>
              <SelectItem value="on-first-retry">First Retry</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>Screenshot</Label>
          <Select value={value.screenshot} onValueChange={v => !disabled && set('screenshot', v as RunConfig['screenshot'])} disabled={disabled}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="on">Always</SelectItem>
              <SelectItem value="only-on-failure">On Failure</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeout */}
      <div className="space-y-2">
        <Label className={labelCls}>Timeout (ms)</Label>
        <Input
          type="number" min={5000} max={300000} step={1000}
          value={value.timeout}
          disabled={disabled}
          onChange={e => set('timeout', parseInt(e.target.value) || 30000)}
          className={inputCls}
        />
      </div>
    </div>
  )
}
