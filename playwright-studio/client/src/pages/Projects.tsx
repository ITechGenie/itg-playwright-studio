import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { apiClient } from "@/services/api-client"
import { GitUrlParser } from "@/lib/git-url-parser"
import { Settings2Icon, ExternalLinkIcon, PlusIcon, RefreshCwIcon, GitBranchIcon, FolderIcon, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

export default function Projects() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Developer");

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

    apiClient.getMe().then((data: any) => {
      if (data?.user?.name) setUserName(data.user.name);
    }).catch(() => { });

    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-6xl px-6 py-12 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome, {userName}!</h1>
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
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-4 border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900"
                onClick={() => navigate("/app/admin/settings")}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Studio Settings
              </Button>
            )}
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
                <TableHead>Type</TableHead>
                <TableHead>Git Project Id</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
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
                  <TableCell>
                    {proj.repoBaseUrl ? (
                      <Badge variant="outline" className="gap-1.5 border-blue-800 text-blue-400 text-[10px]">
                        <GitBranchIcon className="h-3 w-3" /> Git
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 border-zinc-700 text-zinc-500 text-[10px]">
                        <FolderIcon className="h-3 w-3" /> Local
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs">
                    {proj.repoBaseUrl ? (
                      <a
                        href={GitUrlParser.reconstruct({
                          repoBaseUrl: proj.repoBaseUrl,
                          branch: proj.repoBranch || 'main',
                          folderPath: proj.repoFolder || '/',
                          provider: proj.repoBaseUrl.includes('github') ? 'github' : 'gitlab',
                          repoOwner: '',
                          repoName: ''
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-400 transition-colors flex flex-col items-start gap-0.5"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          {proj.gitRepoId ? "Project Id: " + proj.gitRepoId : '--'}
                          <span className="mx-0.5">•</span>
                          <GitBranchIcon className="h-2.5 w-2.5" />
                          <span>{proj.repoBranch || 'main'}</span>
                          {proj.repoFolder && proj.repoFolder !== '/' && (
                            <>
                              <span className="mx-0.5">•</span>
                              <FolderIcon className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[100px]">/{proj.repoFolder}</span>
                            </>
                          )}
                        </div>

                      </a>
                    ) : (
                      <span className="capitalize">{'--'}</span>
                    )}
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
