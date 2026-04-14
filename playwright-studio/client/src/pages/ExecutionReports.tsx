import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from "recharts"
import { RefreshCwIcon, AlertCircleIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { apiClient } from "@/services/api-client"

// ─── Types ───────────────────────────────────────────────────────────────────

type Days = 7 | 30 | 90

interface ReportData {
  totalRuns: number
  passRate: number
  avgDurationMs: number | null
  lastRunAt: string | null
  statusOverTime: { date: string; completed: number; failed: number; stopped: number }[]
  durationTrend: { date: string; avgDurationSec: number }[]
  statusBreakdown: { completed: number; failed: number; stopped: number; running: number }
  topFailingPaths: { targetPath: string; failCount: number; lastFailed: string }[]
  runsByTrigger: { trigger: string; count: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  completed: "#22c55e",
  failed: "#ef4444",
  stopped: "#71717a",
  running: "#3b82f6",
}

const statusOverTimeConfig = {
  completed: { label: "Completed", color: STATUS_COLORS.completed },
  failed: { label: "Failed", color: STATUS_COLORS.failed },
  stopped: { label: "Stopped", color: STATUS_COLORS.stopped },
}

const durationTrendConfig = {
  avgDurationSec: { label: "Avg Duration (s)", color: "#3b82f6" },
}

const statusBreakdownConfig = {
  completed: { label: "Completed", color: STATUS_COLORS.completed },
  failed: { label: "Failed", color: STATUS_COLORS.failed },
  stopped: { label: "Stopped", color: STATUS_COLORS.stopped },
  running: { label: "Running", color: STATUS_COLORS.running },
}

const runsByTriggerConfig = {
  count: { label: "Runs", color: "#3b82f6" },
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card className="bg-zinc-950/40 border-zinc-800">
      <CardHeader className="pb-2">
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full rounded-xl" />
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string
  sub?: string
}

function StatCard({ title, value, sub }: StatCardProps) {
  return (
    <Card className="bg-zinc-950/40 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecutionReports() {
  const { id: projectId } = useParams<{ id: string }>()
  const [days, setDays] = useState<Days>(30)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.getExecutionReports(projectId, days)
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [projectId, days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived stat card values ──────────────────────────────────────────────

  const noData = !data || data.totalRuns === 0

  const totalRunsValue = noData ? "—" : String(data.totalRuns)
  const passRateValue = noData ? "—" : `${data.passRate}%`
  const avgDurationValue =
    noData || data.avgDurationMs == null
      ? "—"
      : `${(data.avgDurationMs / 1000).toFixed(1)}s`
  const lastRunValue =
    noData || data.lastRunAt == null ? "—" : timeAgo(data.lastRunAt)

  // ── Donut total ───────────────────────────────────────────────────────────

  const donutTotal = data
    ? Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0)
    : 0

  const donutData = data
    ? (["completed", "failed", "stopped", "running"] as const)
        .map((key) => ({
          name: key,
          value: data.statusBreakdown[key],
          fill: STATUS_COLORS[key],
        }))
        .filter((d) => d.value > 0)
    : []

  // ── Time range selector ───────────────────────────────────────────────────

  const timeRangeSelector = (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
      {([7, 30, 90] as Days[]).map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={cn(
            "px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
            days === d
              ? "bg-zinc-800 text-white shadow-lg"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <PageHeader
        title="Execution Reports"
        description="Aggregated analytics for your test suite — pass rates, duration trends, and failure hotspots."
        action={timeRangeSelector}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-2 space-y-6">

          {/* ── Error state ─────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
              <AlertCircleIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                className="h-7 text-[10px] border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                <RefreshCwIcon className="h-3 w-3 mr-1.5" />
                Retry
              </Button>
            </div>
          )}

          {/* ── Summary stat cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard title="Total Runs" value={totalRunsValue} />
                <StatCard title="Pass Rate" value={passRateValue} />
                <StatCard title="Average Duration" value={avgDurationValue} />
                <StatCard title="Last Run" value={lastRunValue} />
              </>
            )}
          </div>

          {/* ── Charts row 1: Status Over Time + Duration Trend ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Run Status Over Time */}
            <Card className="bg-zinc-950/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Run Status Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <ChartContainer config={statusOverTimeConfig} className="h-[220px] w-full">
                    <BarChart data={data?.statusOverTime ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="stopped" stackId="a" fill={STATUS_COLORS.stopped} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Duration Trend */}
            <Card className="bg-zinc-950/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Duration Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <ChartContainer config={durationTrendConfig} className="h-[220px] w-full">
                    <LineChart data={data?.durationTrend ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                        unit="s"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="avgDurationSec"
                        stroke={durationTrendConfig.avgDurationSec.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: durationTrendConfig.avgDurationSec.color }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Charts row 2: Status Breakdown + Runs by Trigger ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Status Breakdown donut */}
            <Card className="bg-zinc-950/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <ChartContainer config={statusBreakdownConfig} className="h-[220px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-white text-2xl font-bold"
                                  fontSize={24}
                                  fontWeight="bold"
                                  fill="white"
                                >
                                  {donutTotal}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy ?? 0) + 20}
                                  fontSize={10}
                                  fill="#71717a"
                                >
                                  total
                                </tspan>
                              </text>
                            )
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Runs by Trigger — horizontal bar */}
            <Card className="bg-zinc-950/40 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Runs by Trigger
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <ChartContainer config={runsByTriggerConfig} className="h-[220px] w-full">
                    <BarChart
                      data={data?.runsByTrigger ?? []}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="trigger"
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill={runsByTriggerConfig.count.color} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Top Failing Test Paths table ─────────────────────────────── */}
          <Card className="bg-zinc-950/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Top Failing Test Paths
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !data || data.topFailingPaths.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-zinc-500">
                  No failures in this period.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-zinc-900/50">
                    <TableRow className="hover:bg-transparent border-zinc-800">
                      <TableHead className="text-[10px] font-bold uppercase text-zinc-500 pl-6">
                        Test Path
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-zinc-500 w-28">
                        Fail Count
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-zinc-500 w-40 pr-6">
                        Last Failed
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topFailingPaths.map((row, i) => (
                      <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-900/40">
                        <TableCell className="pl-6 font-mono text-xs text-blue-400 truncate max-w-xs">
                          {row.targetPath}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-red-400">
                          {row.failCount}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400 pr-6">
                          {timeAgo(row.lastFailed)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
