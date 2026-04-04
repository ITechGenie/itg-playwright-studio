import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import {
  CalendarClockIcon, PencilIcon, Trash2Icon, RefreshCwIcon,
  Loader2Icon, ExternalLinkIcon, PlusIcon, ClockIcon, PlayIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { ScheduleDrawer } from "@/components/schedule-drawer"
import { patternToHuman } from "@/components/visual-schedule-builder"

interface Schedule {
  id: string
  projectId: string
  name: string
  targetPaths: string[]
  config: any
  pattern: any
  cronExpression: string
  enabled: boolean
  createdAt: string
  lastRunAt: string | null
  lastRunId: string | null
  nextRunAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function Schedules() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [runningNowId, setRunningNowId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiClient.getSchedules(projectId)
      setSchedules(data)
    } catch (err) {
      console.error('Failed to load schedules', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (schedule: Schedule, enabled: boolean) => {
    setTogglingId(schedule.id)
    try {
      await apiClient.updateSchedule(projectId!, schedule.id, { enabled })
      setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, enabled } : s))
    } catch (err) {
      console.error('Failed to toggle schedule', err)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !projectId) return
    setDeleting(true)
    try {
      await apiClient.deleteSchedule(projectId, deleteTarget.id)
      setSchedules(prev => prev.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete schedule', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleRunNow = async (schedule: Schedule) => {
    if (!projectId) return
    setRunningNowId(schedule.id)
    try {
      await apiClient.runScheduleNow(projectId, schedule.id)
      // Refresh to show updated lastRunAt
      setTimeout(load, 1500)
    } catch (err) {
      console.error('Failed to trigger run', err)
    } finally {
      setRunningNowId(null)
    }
  }

  const openEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setDrawerOpen(true)
  }

  const openCreate = () => {
    setEditingSchedule(null)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PageHeader
        title="Schedules"
        description="Manage recurring test runs. Each schedule stores its own configuration and recurrence pattern independently."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-11 border-zinc-800 bg-zinc-900 text-zinc-400 font-bold px-4 hover:text-white"
              onClick={load}
              disabled={loading}
            >
              <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button
              size="lg"
              className="h-11 gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold px-6"
              onClick={openCreate}
            >
              <PlusIcon className="h-5 w-5" />
              New Schedule
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2Icon className="h-6 w-6 animate-spin mr-2" />
            Loading schedules…
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
            <CalendarClockIcon className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">No schedules yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create a schedule to run tests automatically on a recurring basis.</p>
            </div>
            <Button
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold gap-2"
              onClick={openCreate}
            >
              <PlusIcon className="h-4 w-4" /> Create your first schedule
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-bold uppercase tracking-wide w-[200px]">Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Recurrence</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Targets</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Next Run</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Last Run</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide w-[80px]">Active</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map(schedule => (
                  <TableRow key={schedule.id} className="group">
                    <TableCell>
                      <div className="font-semibold text-sm">{schedule.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{schedule.cronExpression}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ClockIcon className="h-3 w-3 shrink-0" />
                        {patternToHuman(schedule.pattern)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {schedule.targetPaths.length === 0 ? (
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">All tests</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                          {schedule.targetPaths.length} file{schedule.targetPaths.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(schedule.nextRunAt)}
                    </TableCell>
                    <TableCell>
                      {schedule.lastRunId ? (
                        <button
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                          onClick={() => navigate(`/app/project/${projectId}/executions/runs?runId=${schedule.lastRunId}`)}
                        >
                          {formatDate(schedule.lastRunAt)}
                          <ExternalLinkIcon className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.enabled}
                        disabled={togglingId === schedule.id}
                        onCheckedChange={v => handleToggle(schedule, v)}
                        className="data-[state=checked]:bg-purple-600"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-green-400"
                          onClick={() => handleRunNow(schedule)}
                          disabled={runningNowId === schedule.id}
                          title="Run now"
                        >
                          {runningNowId === schedule.id
                            ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                            : <PlayIcon className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-white"
                          onClick={() => openEdit(schedule)}
                          title="Edit schedule"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-red-400"
                          onClick={() => setDeleteTarget(schedule)}
                          title="Delete schedule"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Schedule Drawer (create / edit) */}
      {projectId && (
        <ScheduleDrawer
          projectId={projectId}
          open={drawerOpen}
          onOpenChange={open => {
            setDrawerOpen(open)
            if (!open) setEditingSchedule(null)
          }}
          schedule={editingSchedule ?? undefined}
          onSaved={load}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.name}" will be permanently deleted and will no longer run automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <><Loader2Icon className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
