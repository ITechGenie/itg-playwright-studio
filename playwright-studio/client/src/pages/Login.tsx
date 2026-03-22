import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Playwright Studio</h1>
        <p className="text-muted-foreground w-80">
          The central control plane for your automated browser testing and interaction flows.
        </p>
        <Button size="lg" className="w-full" onClick={() => navigate('/app/projects')}>
          Login with GitLab
        </Button>
      </div>
    </div>
  )
}
