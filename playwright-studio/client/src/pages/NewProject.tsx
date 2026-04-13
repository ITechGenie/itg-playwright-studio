import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/services/api-client"
import { GitUrlParser } from "@/lib/git-url-parser"
import { ArrowLeftIcon, Loader2Icon, SparklesIcon, FolderIcon, GitBranchIcon } from "lucide-react"

type ImportMode = 'empty' | 'git';

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [importMode, setImportMode] = useState<ImportMode>('empty')
  const [gitBaseUrl, setGitBaseUrl] = useState("")
  const [gitBranch, setGitBranch] = useState("main")
  const [gitFolder, setGitFolder] = useState("/")
  const [gitUrlError, setGitUrlError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basic client-side Git URL validation
  const validateGitBaseUrl = (url: string): string | null => {
    if (!url.trim()) {
      return "Git Base URL is required"
    }
    
    // Support standard and custom domains like gitlab.com, github.com, gitlab.prakash.com
    const gitPattern = /^https:\/\/[a-zA-Z0-9.-]+\/[\w.-]+\/[\w.-]+/
    
    if (!gitPattern.test(url)) {
      return "Invalid Git URL format. Expected base repository URL (e.g., https://gitlab.com/owner/repo)"
    }
    
    return null
  }

  const handleGitUrlChange = (value: string) => {
    if (value.includes('/-/tree/') || value.includes('/tree/')) {
      try {
        const parsed = GitUrlParser.parse(value);
        setGitBaseUrl(parsed.repoBaseUrl);
        setGitBranch(parsed.branch);
        setGitFolder(parsed.folderPath || '/');
        setGitUrlError(null);
        setError(null);
        return;
      } catch (err) {
        // Fall back to standard assignment if parsing fails
      }
    }
    setGitBaseUrl(value)
    setGitUrlError(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return

    // Validate Git URL if import mode is git
    if (importMode === 'git') {
      const validationError = validateGitBaseUrl(gitBaseUrl)
      if (validationError) {
        setGitUrlError(validationError)
        return
      }
    }

    setLoading(true)
    setError(null)
    setGitUrlError(null)
    
    try {
      const gitConfig = importMode === 'git' ? {
        baseUrl: gitBaseUrl.trim().replace(/\/+$/, ''),
        branch: gitBranch.trim().replace(/^\/+|\/+$/g, '') || 'main',
        folder: gitFolder.trim().replace(/^\/+|\/+$/g, '') || '/'
      } : undefined;

      const result = await apiClient.createProject(
        name.trim(), 
        gitConfig
      )
      // Redirection to project deep link
      navigate(`/app/project/${result.id}/specs`)
    } catch (err: any) {
      setError(err.message || "Failed to create project")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-x-0 top-0 h-[50vh] bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-zinc-500 hover:text-white transition-colors group"
          onClick={() => navigate("/app/projects")}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Projects
        </Button>

        <Card className="border-zinc-800/50 bg-zinc-950/40 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none select-none">
             <SparklesIcon className="h-24 w-24 text-blue-400 rotate-12" />
          </div>
          
          <CardHeader className="pt-8 px-8 pb-4">
            <CardTitle className="text-3xl font-extrabold tracking-tight text-white mb-2">New Workspace</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Establish a new environment for your automation suite.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="p-8 pt-4 space-y-8">
              {/* Project Folder Name */}
              <div className="space-y-3">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex justify-between items-center">
                  <span>Project Identifier</span>
                  {name && <span className="text-blue-500/60 lowercase font-medium tracking-normal animate-in fade-in slide-in-from-right-1">valid format</span>}
                </Label>
                <div className="relative group">
                  <Input
                    id="name"
                    placeholder="my-awesome-suite"
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                    className="h-12 bg-zinc-900/50 border-zinc-800/80 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-zinc-100 placeholder:text-zinc-700 transition-all duration-300"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-zinc-600 font-medium tracking-wide">
                  Reserved as the directory name on the execution cluster.
                </p>
              </div>

              {/* Project Type List */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Select Foundation
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Empty Project Card */}
                  <div 
                    onClick={() => setImportMode('empty')}
                    className={`
                      cursor-pointer group relative p-4 rounded-2xl border-2 transition-all duration-300 flex flex-row items-center gap-4
                      ${importMode === 'empty' 
                        ? 'bg-blue-600/10 border-blue-600/80 shadow-[0_0_20px_-5px_rgba(37,99,235,0.3)]' 
                        : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'}
                    `}
                  >
                    <div className={`
                      p-2.5 rounded-xl transition-colors duration-300 shrink-0
                      ${importMode === 'empty' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}
                    `}>
                      <FolderIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold mb-0.5 truncate ${importMode === 'empty' ? 'text-white' : 'text-zinc-300'}`}>Empty Workspace</h4>
                      <p className="text-[10px] text-zinc-500 leading-tight font-medium line-clamp-2">Start fresh and build manually.</p>
                    </div>
                    
                    {importMode === 'empty' && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shrink-0" />
                    )}
                  </div>

                  {/* Import from Git Card */}
                  <div 
                    onClick={() => setImportMode('git')}
                    className={`
                      cursor-pointer group relative p-4 rounded-2xl border-2 transition-all duration-300 flex flex-row items-center gap-4
                      ${importMode === 'git' 
                        ? 'bg-indigo-600/10 border-indigo-600/80 shadow-[0_0_20px_-5px_rgba(79,70,229,0.3)]' 
                        : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'}
                    `}
                  >
                    <div className={`
                      p-2.5 rounded-xl transition-colors duration-300 shrink-0
                      ${importMode === 'git' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}
                    `}>
                      <GitBranchIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold mb-0.5 truncate ${importMode === 'git' ? 'text-white' : 'text-zinc-300'}`}>Clone from Git</h4>
                      <p className="text-[10px] text-zinc-500 leading-tight font-medium line-clamp-2">Sync directly from your repository.</p>
                    </div>

                    {importMode === 'git' && (
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Git URL Inputs (Dynamic) */}
              {importMode === 'git' && (
                <div className="space-y-4 p-5 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 animate-in fade-in zoom-in-95 duration-500">
                  <div className="space-y-3">
                    <Label htmlFor="gitBaseUrl" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/70">
                      Repository Base URL
                    </Label>
                    <Input
                      id="gitBaseUrl"
                      placeholder="https://github.com/org/repo"
                      value={gitBaseUrl}
                      onChange={(e) => handleGitUrlChange(e.target.value)}
                      className="h-11 bg-zinc-900/50 border-indigo-900/30 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-zinc-100 placeholder:text-zinc-700"
                      required={importMode === 'git'}
                    />
                    <p className="text-[10px] text-indigo-500/50 font-medium">
                      Supports GitHub or GitLab. Self-hosted instances are allowed.
                    </p>
                    {gitUrlError && (
                      <div className="mt-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-[11px] font-medium animate-in shake-1 duration-300">
                        {gitUrlError}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="gitBranch" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/70">
                        Branch
                      </Label>
                      <Input
                        id="gitBranch"
                        placeholder="main"
                        value={gitBranch}
                        onChange={(e) => setGitBranch(e.target.value)}
                        className="h-11 bg-zinc-900/50 border-indigo-900/30 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-zinc-100 placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="gitFolder" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/70">
                        Folder Path
                      </Label>
                      <Input
                        id="gitFolder"
                        placeholder="/"
                        value={gitFolder}
                        onChange={(e) => setGitFolder(e.target.value)}
                        className="h-11 bg-zinc-900/50 border-indigo-900/30 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-zinc-100 placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {error}
                </div>
              )}
            </CardContent>
            
            <CardFooter className="p-8 pt-0">
              <Button 
                type="submit" 
                size="lg"
                className={`
                  w-full h-14 rounded-2xl font-bold text-base transition-all duration-500 relative overflow-hidden group
                  ${importMode === 'git' 
                    ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' 
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}
                  shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)]
                `} 
                disabled={loading || !name}
              >
                <div className="absolute inset-x-0 top-0 h-full w-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <Loader2Icon className="h-5 w-5 animate-spin" />
                      <span>{importMode === 'git' ? 'Initializing Git...' : 'Preparing Workspace...'}</span>
                    </>
                  ) : (
                    <>
                      {importMode === 'git' ? <GitBranchIcon className="h-5 w-5" /> : <FolderIcon className="h-5 w-5" />}
                      <span>{importMode === 'git' ? 'Import & Launch Explorer' : 'Create & Launch Explorer'}</span>
                    </>
                  )}
                </div>
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
