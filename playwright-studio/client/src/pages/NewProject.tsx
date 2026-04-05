import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { apiClient } from "@/services/api-client"
import { ArrowLeftIcon, Loader2Icon, SparklesIcon, FolderIcon, GitBranchIcon } from "lucide-react"

type ImportMode = 'empty' | 'git';

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [importMode, setImportMode] = useState<ImportMode>('empty')
  const [gitUrl, setGitUrl] = useState("")
  const [gitUrlError, setGitUrlError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basic client-side Git URL validation
  const validateGitUrl = (url: string): string | null => {
    if (!url.trim()) {
      return "Git URL is required"
    }
    
    const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/tree\/[\w.-]+/
    const gitlabPattern = /^https:\/\/gitlab\.com\/[\w-]+(\/[\w.-]+)*\/-\/tree\/[\w.-]+/
    
    if (!githubPattern.test(url) && !gitlabPattern.test(url)) {
      return "Invalid Git URL format. Expected GitHub or GitLab tree URL (e.g., https://github.com/owner/repo/tree/branch/path)"
    }
    
    return null
  }

  const handleGitUrlChange = (value: string) => {
    setGitUrl(value)
    setGitUrlError(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return

    // Validate Git URL if import mode is git
    if (importMode === 'git') {
      const validationError = validateGitUrl(gitUrl)
      if (validationError) {
        setGitUrlError(validationError)
        return
      }
    }

    setLoading(true)
    setError(null)
    setGitUrlError(null)
    
    try {
      const result = await apiClient.createProject(
        name.trim(), 
        importMode === 'git' ? gitUrl.trim() : undefined
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-background to-background">
      <div className="w-full max-w-md space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-white mb-4"
          onClick={() => navigate("/app/projects")}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-xl shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <SparklesIcon className="h-16 w-16 text-blue-500" />
          </div>
          
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">New Workspace</CardTitle>
            <CardDescription className="text-zinc-500">
              Create a fresh environment for your Playwright tests.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Project Folder Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. my-awesome-project"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                  className="bg-zinc-900 border-zinc-800 focus-visible:ring-blue-500 text-zinc-200"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-zinc-600">
                  This will create a directory on the server under the projects root.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Project Type
                </Label>
                <ToggleGroup 
                  type="single" 
                  value={importMode} 
                  onValueChange={(value) => {
                    if (value) setImportMode(value as ImportMode)
                  }}
                  className="w-full grid grid-cols-2 gap-2"
                >
                  <ToggleGroupItem 
                    value="empty" 
                    className="flex flex-col items-center gap-2 h-auto py-3 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                  >
                    <FolderIcon className="h-5 w-5" />
                    <span className="text-xs font-medium">Create Empty Project</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="git" 
                    className="flex flex-col items-center gap-2 h-auto py-3 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                  >
                    <GitBranchIcon className="h-5 w-5" />
                    <span className="text-xs font-medium">Import from Git</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {importMode === 'git' && (
                <div className="space-y-2">
                  <Label htmlFor="gitUrl" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Git Repository URL
                  </Label>
                  <Input
                    id="gitUrl"
                    placeholder="https://github.com/owner/repo/tree/main/tests"
                    value={gitUrl}
                    onChange={(e) => handleGitUrlChange(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-blue-500 text-zinc-200"
                    required={importMode === 'git'}
                  />
                  <p className="text-[10px] text-zinc-600">
                    Provide a GitHub or GitLab tree URL including branch and folder path.
                  </p>
                  {gitUrlError && (
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                      {gitUrlError}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                  {error}
                </div>
              )}
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold" 
                disabled={loading || !name}
              >
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    {importMode === 'git' ? 'Importing...' : 'Creating...'}
                  </>
                ) : (
                  importMode === 'git' ? 'Import & Open Explorer' : 'Create & Open Explorer'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
