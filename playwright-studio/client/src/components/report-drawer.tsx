import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";

export interface ReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportUrl: string | null;
  reportType: "html" | "monocart" | null;
}

export function ReportDrawer({ open, onOpenChange, reportUrl, reportType }: ReportDrawerProps) {
  if (!reportUrl) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-[90vw] !w-[90vw] p-0 flex flex-col bg-zinc-950 border-l border-zinc-800">
        <SheetHeader className="p-4 pr-12 border-b border-zinc-800 flex flex-row items-center justify-between space-y-0 shrink-0">
          <SheetTitle className="text-lg font-bold capitalize text-white">
            {reportType === "html" ? "HTML Report" : "Monocart Report"}
          </SheetTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800"
              onClick={() => window.open(reportUrl, "_blank")}
            >
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-hidden relative bg-white">
          <iframe
            src={reportUrl}
            className="w-full h-full border-none"
            title="Report Viewer"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
