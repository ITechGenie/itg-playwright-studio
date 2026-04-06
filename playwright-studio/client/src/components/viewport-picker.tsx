import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESETS = [
  { label: "Desktop HD",    w: 1920, h: 1080 },
  { label: "Desktop",       w: 1280, h: 720  },
  { label: "Laptop",        w: 1366, h: 768  },
  { label: "Laptop SM",     w: 1024, h: 768  },
  { label: "Tablet (land)", w: 1024, h: 600  },
  { label: "Tablet (port)", w: 768,  h: 1024 },
  { label: "Mobile L",      w: 425,  h: 900  },
  { label: "Mobile M",      w: 375,  h: 812  },
  { label: "Mobile S",      w: 320,  h: 568  },
]

interface ViewportPickerProps {
  /** compact = tiny pencil icon (for test-runner-panel), full = normal button (for settings/drawer) */
  size?: "compact" | "full"
  onSelect: (w: number, h: number) => void
  currentW?: number
  currentH?: number
}

export function ViewportPicker({ size = "full", onSelect, currentW, currentH }: ViewportPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {size === "compact" ? (
          <Button variant="ghost" size="icon"
            className="h-5 w-5 text-zinc-600 hover:text-blue-400 p-0 shrink-0"
            title="Pick viewport preset">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm"
            className="h-8 border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white gap-1.5 text-xs">
            <Pencil className="h-3 w-3" /> Presets
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start"
        className="w-52 p-1.5 bg-zinc-950 border-zinc-800 shadow-xl">
        <p className="text-[9px] font-bold uppercase text-zinc-600 tracking-widest px-2 py-1">Common Viewports</p>
        {PRESETS.map(p => {
          const active = currentW === p.w && currentH === p.h
          return (
            <button key={p.label} onClick={() => onSelect(p.w, p.h)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-zinc-800 transition-colors",
                active ? "text-blue-400 bg-zinc-900" : "text-zinc-300"
              )}>
              <span className="font-medium">{p.label}</span>
              <span className="font-mono text-[10px] text-zinc-500">{p.w}×{p.h}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
