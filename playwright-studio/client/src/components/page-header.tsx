import { useLocation } from "react-router-dom"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title?: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, className, action }: PageHeaderProps) {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter(x => x)

  const getRouteTitle = (segment: string) => {
    if (!segment) return "Dashboard"
    if (segment === "specs") return "User Journeys"
    if (segment === "runs") return "Execution History"
    if (segment === "settings") return "Settings"
    if (segment === "data") return "Data Manager"
    if (segment === "templates") return "Data Templates"
    if (segment === "environments") return "Environments & Sets"
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ')
  }

  // Determine standard title if not provided (fallback logic)
  const searchParams = new URLSearchParams(location.search)
  const folderPath = searchParams.get("path")
  
  let fallbackTitle = pathnames.length > 0 ? getRouteTitle(pathnames[pathnames.length - 1]) : "Dashboard"
  if (folderPath && fallbackTitle.includes("User Journeys")) {
     fallbackTitle = `User Journeys (${folderPath})`
  }

  const activeTitle = title || fallbackTitle

  return (
    <div className={cn("flex flex-col gap-4 pb-4 px-6 pt-6 bg-zinc-950/20", className)}>
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-px bg-zinc-800" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/app/projects">Playwright Studio</BreadcrumbLink>
            </BreadcrumbItem>
            {pathnames.length > 3 && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-zinc-400">
                    {getRouteTitle(pathnames[3])}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {pathnames.length > 4 && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{getRouteTitle(pathnames[4])}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex justify-between items-end gap-6 pr-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">{activeTitle}</h1>
          {description && (
            <p className="text-muted-foreground text-sm max-w-2xl">{description}</p>
          )}
        </div>
        {action && (
          <div className="flex items-center gap-3 pb-1">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
