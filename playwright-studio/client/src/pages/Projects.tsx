import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { apiClient } from "@/services/api-client"
import { Settings2Icon, ExternalLinkIcon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      localStorage.setItem('authToken', tokenFromUrl);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      window.location.href = '/app/login';
      return;
    }

    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-6xl px-6 py-12 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome, Developer!</h1>
          <p className="text-muted-foreground text-sm">Select a project workspace or create a new one to get started</p>
          <div className="flex items-center gap-3 mt-6">
            <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900"
                onClick={async () => {
                   setLoading(true);
                   try { await apiClient.syncProjects(); await fetchProjects(); }
                   catch (err) { console.error(err); }
                   finally { setLoading(false); }
                }}
            >
              <RefreshCwIcon className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Sync Folders
            </Button>
            <Button 
                className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/10"
                onClick={() => navigate("/app/projects/new")}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
          <div className="w-full max-w-lg mt-4">
            <Input type="text" placeholder="Search projects..." className="w-full h-11 bg-zinc-900/50 border-zinc-800" />
          </div>
        </div>

        <div className="rounded-md border bg-card relative overflow-hidden">
          {loading && (
             <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-sm">
                <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
             </div>
          )}
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Workspace Path</TableHead>
                <TableHead>Default Browser</TableHead>
                <TableHead>Viewport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No workspaces found in environment path.
                  </TableCell>
                </TableRow>
              )}
              {projects.map((proj) => (
                <TableRow key={proj.id} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-medium text-primary">
                    <div className="flex flex-col">
                      <span>{proj.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{proj.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-zinc-400 text-xs">
                    {proj.config?.browser || 'chromium'}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs">
                    {proj.config?.viewportWidth}x{proj.config?.viewportHeight}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-medium uppercase tracking-wider">
                      {proj.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                      onClick={() => navigate(`/app/project/${proj.id}/settings/run`)}
                      title="Run Configuration"
                    >
                      <Settings2Icon className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate(`/app/project/${proj.id}/specs`)}>
                      Open Explorer
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
