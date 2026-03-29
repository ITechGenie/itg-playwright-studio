import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/services/api-client"
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react"

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.createProject(name.trim())
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
                    Creating...
                  </>
                ) : (
                  "Create & Open Explorer"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
