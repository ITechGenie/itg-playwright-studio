import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { CalendarClockIcon, Loader2Icon, CheckCircleIcon, AlertCircleIcon, FileIcon } from "lucide-react"
import { ConfigPanel, type RunConfig, DEFAULT_RUN_CONFIG } from "@/components/config-panel"
import { VisualScheduleBuilder, type SchedulePattern, DEFAULT_SCHEDULE_PATTERN } from "@/components/visual-schedule-builder"
import { apiClient } from "@/services/api-client"
import { cn } from "@/lib/utils"

export interface ScheduleDrawerProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  targetPaths?: string[]
  initialConfig?: RunConfig
  /** If provided, opens in edit mode pre-filled with this schedule */
  schedule?: any
  onSaved?: () => void
}

const labelCls = "text-[11px] uppercase font-bold text-muted-foreground tracking-wide"

export function ScheduleDrawer({
  projectId,
  open,
  onOpenChange,
  targetPaths = [],
  initialConfig,
  schedule,
  onSaved,
}: ScheduleDrawerProps) {
  const isEdit = !!schedule

  const [name, setName] = useState("")
  const [config, setConfig] = useState<RunConfig>(DEFAULT_RUN_CONFIG)
  const [pattern, setPattern] = useState<SchedulePattern>(DEFAULT_SCHEDULE_PATTERN)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Env / dataset state
  const [environments, setEnvironments] = useState<any[]>([])
  const [selectedEnvId, setSelectedEnvId] = useState<string>("none")
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([])

  // Fetch environments once on open
  useEffect(() => {
    if (!open) return
    apiClient.getDataEnvironments(projectId)
      .then(data => setEnvironments(data))
      .catch(() => {})
  }, [open, projectId])

  // Fetch full env (with datasets) when env selection changes
  useEffect(() => {
    setSelectedDatasetIds([])
    if (selectedEnvId && selectedEnvId !== "none") {
      apiClient.getDataEnvironment(projectId, selectedEnvId)
        .then(fullEnv => setEnvironments(prev => prev.map(e => e.id === fullEnv.id ? fullEnv : e)))
        .catch(() => {})
    }
  }, [selectedEnvId, projectId])

  // Pre-fill when editing
  useEffect(() => {
    if (schedule) {
      setName(schedule.name ?? "")
      setConfig(schedule.config ?? initialConfig ?? DEFAULT_RUN_CONFIG)
      setPattern(schedule.pattern ?? DEFAULT_SCHEDULE_PATTERN)
      setSelectedEnvId(schedule.config?.envId ?? "none")
      setSelectedDatasetIds(schedule.config?.dataSetIds ?? [])
    } else {
      setName("")
      setConfig(initialConfig ?? DEFAULT_RUN_CONFIG)
      setPattern(DEFAULT_SCHEDULE_PATTERN)
      setSelectedEnvId("none")
      setSelectedDatasetIds([])
    }
    setFeedback(null)
  }, [schedule, open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Schedule name is required' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const payload = {
        name: name.trim(),
        targetPaths,
        config: {
          ...config,
          envId: selectedEnvId !== "none" ? selectedEnvId : undefined,
          dataSetIds: selectedDatasetIds.length > 0 ? selectedDatasetIds : undefined,
        },
        pattern,
      }

      if (isEdit) {
        await apiClient.updateSchedule(projectId, schedule.id, payload)
      } else {
        await apiClient.createSchedule(projectId, payload)
      }

      setFeedback({ type: 'success', message: isEdit ? 'Schedule updated!' : 'Schedule created!' })
      onSaved?.()
      setTimeout(() => onOpenChange(false), 800)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save schedule' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ width: '90vw', maxWidth: '90vw' }} className="flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClockIcon className="h-5 w-5 text-purple-400" />
            <SheetTitle className="text-base">{isEdit ? 'Edit Schedule' : 'Schedule Tests'}</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {isEdit
              ? 'Update the schedule configuration and recurrence pattern.'
              : 'Configure a recurring test run. Each schedule stores its own config independently.'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">

            {/* Target paths summary */}
            {targetPaths.length > 0 && (
              <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 space-y-1">
                <span className={labelCls}>Target files ({targetPaths.length})</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {targetPaths.slice(0, 5).map(p => (
                    <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-background border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                      <FileIcon className="h-2.5 w-2.5" />{p.split('/').pop()}
                    </span>
                  ))}
                  {targetPaths.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{targetPaths.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
            {targetPaths.length === 0 && (
              <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                Runs all tests in the workspace
              </div>
            )}

            {/* Schedule name */}
            <div className="space-y-2">
              <Label className={labelCls}>Schedule name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Nightly Regression"
                maxLength={100}
                className="h-9 text-sm"
              />
            </div>

            <Separator />

            {/* Schedule recurrence */}
            <div className="space-y-3">
              <Label className={labelCls}>Recurrence</Label>
              <VisualScheduleBuilder value={pattern} onChange={setPattern} />
            </div>

            <Separator />

            {/* Env & Datasets */}
            {environments.length > 0 && (
              <div className="space-y-3">
                <Label className={labelCls}>Data Environment</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Env</span>
                    <Select value={selectedEnvId} onValueChange={setSelectedEnvId}>
                      <SelectTrigger className="h-8 w-[160px] text-xs bg-background border-border">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {environments.map(env => (
                          <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedEnvId && selectedEnvId !== "none" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Datasets</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-8 px-3 text-xs bg-background border-border text-muted-foreground min-w-[140px] justify-start font-normal hover:text-foreground">
                            {selectedDatasetIds.length > 0
                              ? `${selectedDatasetIds.length} scenario${selectedDatasetIds.length > 1 ? 's' : ''}`
                              : "Select variants…"}
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
                                onCheckedChange={checked =>
                                  setSelectedDatasetIds(prev =>
                                    checked ? [...prev, ds.id] : prev.filter(id => id !== ds.id)
                                  )
                                }
                              >
                                {ds.name}
                              </DropdownMenuCheckboxItem>
                            ))
                          ) : (
                            <div className="p-2 text-xs text-zinc-500">No datasets created.</div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Run config */}
            <div className="space-y-3">
              <Label className={labelCls}>Run configuration</Label>
              <ConfigPanel value={config} onChange={setConfig} />
            </div>

          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-col gap-2">
          {/* Feedback */}
          {feedback && (
            <div className={cn(
              "flex items-center gap-2 text-xs rounded-md px-3 py-2 w-full",
              feedback.type === 'success' ? "bg-green-900/20 text-green-400 border border-green-800/40" : "bg-red-900/20 text-red-400 border border-red-800/40"
            )}>
              {feedback.type === 'success'
                ? <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                : <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />}
              {feedback.message}
            </div>
          )}
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-bold"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <><Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                : isEdit ? 'Update Schedule' : 'Create Schedule'
              }
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
