import * as React from "react"
import { Legend, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

// ─── Config types ────────────────────────────────────────────────────────────

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
}

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

// ─── ChartStyle ──────────────────────────────────────────────────────────────

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, cfg]) => cfg.color)
  if (!colorConfig.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorConfig
          .map(([key, cfg]) => `[data-chart=${id}] { --color-${key}: ${cfg.color}; }`)
          .join("\n"),
      }}
    />
  )
}

// ─── ChartContainer ──────────────────────────────────────────────────────────

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { config: ChartConfig; children: React.ReactNode }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border",
          "[&_.recharts-radial-bar-background-sector]:fill-muted",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted",
          "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

// ─── ChartTooltip ────────────────────────────────────────────────────────────

const ChartTooltip = Tooltip

// ─── ChartTooltipContent ─────────────────────────────────────────────────────
// Props are intentionally loose — recharts injects active/payload/label at runtime.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  AnyProps & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
    className?: string
  }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelKey,
      nameKey,
    },
    ref
  ) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!hideLabel && label && (
          <div className="font-medium">
            {labelKey ? (config[labelKey]?.label ?? label) : label}
          </div>
        )}
        <div className="grid gap-1.5">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((item: any, index: number) => {
            const key = nameKey ? String(item[nameKey]) : item.name ?? item.dataKey ?? "value"
            const itemConfig = config[String(key)]
            const indicatorColor = item.color ?? itemConfig?.color

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2",
                  indicator === "dot" && "items-center"
                )}
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px]",
                      indicator === "dot" && "h-2.5 w-2.5 translate-y-[1px]",
                      indicator === "line" && "w-1",
                      indicator === "dashed" && "w-0 border-[1.5px] border-dashed bg-transparent"
                    )}
                    style={{ background: indicatorColor, borderColor: indicatorColor }}
                  />
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                  {item.value !== undefined && (
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// ─── ChartLegend ─────────────────────────────────────────────────────────────

const ChartLegend = Legend

// ─── ChartLegendContent ──────────────────────────────────────────────────────
// Props are intentionally loose — recharts injects payload/verticalAlign at runtime.

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  AnyProps & {
    hideIcon?: boolean
    nameKey?: string
    className?: string
  }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart()

  if (!payload?.length) return null

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((item: any) => {
        const key = nameKey ? String(item[nameKey]) : item.dataKey ?? "value"
        const itemConfig = config[String(key)]

        return (
          <div key={String(item.value)} className="flex items-center gap-1.5">
            {!hideIcon && (
              <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
            )}
            <span className="text-muted-foreground">{itemConfig?.label ?? item.value}</span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
}
