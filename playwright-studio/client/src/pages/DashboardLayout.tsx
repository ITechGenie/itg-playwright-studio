import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Outlet, useLocation } from "react-router-dom"



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
        <main className="flex w-full flex-col overflow-hidden">
          <div className="flex-1 overflow-auto flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
