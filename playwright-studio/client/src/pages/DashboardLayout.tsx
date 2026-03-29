import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Outlet, useLocation } from "react-router-dom"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbLink } from "@/components/ui/breadcrumb"


export default function DashboardLayout() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // Extract path parameters: e.g. /app/project/1/specs
  // pathnames = ["app", "project", "1", "specs"]
  const getRouteTitle = (segment: string) => {
    if (!segment) return "Dashboard";
    if (segment === "specs") return "User Journeys";
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
  };

  // Determine standard title - typically the last logical segment of the router path
  // If we are at /app/project/1/specs?path=scripts, location.search handles the query
  const searchParams = new URLSearchParams(location.search);
  const folderPath = searchParams.get("path");

  let pageTitle = pathnames.length > 0 ? getRouteTitle(pathnames[pathnames.length - 1]) : "Dashboard";
  if (folderPath) {
    pageTitle = `${pageTitle} (${folderPath})`;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full font-sans bg-background text-foreground">
        <AppSidebar />
        <main className="flex w-full flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:h-[60px]">
            <SidebarTrigger />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/app/projects">Playwright Studio</BreadcrumbLink>
                </BreadcrumbItem>
                {pathnames.length > 3 && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{getRouteTitle(pathnames[3])}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div className="flex flex-col flex-1 overflow-auto p-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
