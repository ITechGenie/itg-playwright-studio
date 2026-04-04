import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { ClockIcon } from "lucide-react"

export type ScheduleFrequency = 'interval' | 'daily' | 'weekly' | 'monthly'

export type SchedulePattern = {
  frequency: ScheduleFrequency
  intervalValue?: number
  intervalUnit?: 'minutes' | 'hours'
  dailyTime?: string
  weeklyDays?: number[]
  weeklyTime?: string
  monthlyDay?: number
  monthlyTime?: string
}

export const DEFAULT_SCHEDULE_PATTERN: SchedulePattern = {
  frequency: 'daily',
  dailyTime: '09:00',
}

export type VisualScheduleBuilderProps = {
  value: SchedulePattern
  onChange: (pattern: SchedulePattern) => void
  disabled?: boolean
}

const DAYS = [
  { label: 'S', full: 'Sun', value: 0 },
  { label: 'M', full: 'Mon', value: 1 },
  { label: 'T', full: 'Tue', value: 2 },
  { label: 'W', full: 'Wed', value: 3 },
  { label: 'T', full: 'Thu', value: 4 },
  { label: 'F', full: 'Fri', value: 5 },
  { label: 'S', full: 'Sat', value: 6 },
]

export function patternToCron(pattern: SchedulePattern): string {
  switch (pattern.frequency) {
    case 'interval': {
      const val = pattern.intervalValue ?? 30
      return pattern.intervalUnit === 'hours' ? `0 */${val} * * *` : `*/${val} * * * *`
    }
    case 'daily': {
      const [h, m] = (pattern.dailyTime ?? '09:00').split(':')
      return `${parseInt(m)} ${parseInt(h)} * * *`
    }
    case 'weekly': {
      const [h, m] = (pattern.weeklyTime ?? '09:00').split(':')
      const days = (pattern.weeklyDays ?? [1]).join(',')
      return `${parseInt(m)} ${parseInt(h)} * * ${days}`
    }
    case 'monthly': {
      const [h, m] = (pattern.monthlyTime ?? '09:00').split(':')
      return `${parseInt(m)} ${parseInt(h)} ${pattern.monthlyDay ?? 1} * *`
    }
  }
}

export function patternToHuman(pattern: SchedulePattern): string {
  switch (pattern.frequency) {
    case 'interval': {
      const val = pattern.intervalValue ?? 30
      const unit = pattern.intervalUnit ?? 'minutes'
      return `Runs every ${val} ${unit}`
    }
    case 'daily':
      return `Runs daily at ${pattern.dailyTime ?? '09:00'}`
    case 'weekly': {
      const days = (pattern.weeklyDays ?? [1])
        .map(d => DAYS.find(x => x.value === d)?.full ?? '')
        .join(', ')
      return `Runs every ${days} at ${pattern.weeklyTime ?? '09:00'}`
    }
    case 'monthly':
      return `Runs on day ${pattern.monthlyDay ?? 1} of each month at ${pattern.monthlyTime ?? '09:00'}`
  }
}

const labelCls = "text-[11px] uppercase font-bold text-muted-foreground tracking-wide"
const inputCls = "h-8 text-sm bg-background border-border"

export function VisualScheduleBuilder({ value, onChange, disabled = false }: VisualScheduleBuilderProps) {
  const set = (patch: Partial<SchedulePattern>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4">
      <Tabs
        value={value.frequency}
        onValueChange={f => onChange({ ...DEFAULT_SCHEDULE_PATTERN, frequency: f as ScheduleFrequency })}
      >
        <TabsList className="grid grid-cols-4 w-full h-9">
          <TabsTrigger value="interval" disabled={disabled} className="text-xs">Every X</TabsTrigger>
          <TabsTrigger value="daily" disabled={disabled} className="text-xs">Daily</TabsTrigger>
          <TabsTrigger value="weekly" disabled={disabled} className="text-xs">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" disabled={disabled} className="text-xs">Monthly</TabsTrigger>
        </TabsList>

        {/* ── Every X ── */}
        <TabsContent value="interval" className="mt-4 space-y-3">
          <Label className={labelCls}>Repeat every</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={59}
              value={value.intervalValue ?? 30}
              disabled={disabled}
              onChange={e => set({ intervalValue: parseInt(e.target.value) || 1 })}
              className={cn(inputCls, "w-20")}
            />
            <Select
              value={value.intervalUnit ?? 'minutes'}
              onValueChange={v => set({ intervalUnit: v as 'minutes' | 'hours' })}
              disabled={disabled}
            >
              <SelectTrigger className={cn(inputCls, "w-28")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ── Daily ── */}
        <TabsContent value="daily" className="mt-4 space-y-3">
          <Label className={labelCls}>Run at</Label>
          <Input
            type="time"
            value={value.dailyTime ?? '09:00'}
            disabled={disabled}
            onChange={e => set({ dailyTime: e.target.value })}
            className={cn(inputCls, "w-32")}
          />
        </TabsContent>

        {/* ── Weekly ── */}
        <TabsContent value="weekly" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Days</Label>
            <ToggleGroup
              type="multiple"
              value={(value.weeklyDays ?? [1]).map(String)}
              onValueChange={vals => !disabled && set({ weeklyDays: vals.map(Number) })}
              className="justify-start gap-1"
            >
              {DAYS.map(d => (
                <ToggleGroupItem
                  key={d.value}
                  value={String(d.value)}
                  disabled={disabled}
                  className="h-8 w-8 text-xs font-bold data-[state=on]:bg-blue-600 data-[state=on]:text-white rounded-full"
                  title={d.full}
                >
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>At</Label>
            <Input
              type="time"
              value={value.weeklyTime ?? '09:00'}
              disabled={disabled}
              onChange={e => set({ weeklyTime: e.target.value })}
              className={cn(inputCls, "w-32")}
            />
          </div>
        </TabsContent>

        {/* ── Monthly ── */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelCls}>Day of month</Label>
              <Input
                type="number" min={1} max={31}
                value={value.monthlyDay ?? 1}
                disabled={disabled}
                onChange={e => set({ monthlyDay: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
                className={cn(inputCls, "w-20")}
              />
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>At</Label>
              <Input
                type="time"
                value={value.monthlyTime ?? '09:00'}
                disabled={disabled}
                onChange={e => set({ monthlyTime: e.target.value })}
                className={cn(inputCls, "w-32")}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Human-readable summary */}
      <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
        <ClockIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{patternToHuman(value)}</span>
      </div>
    </div>
  )
}
