import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background text-foreground">
      <FileQuestion className="h-20 w-20 text-muted-foreground opacity-40" />
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or was moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        <Button onClick={() => navigate("/app/projects")}>Go to Projects</Button>
      </div>
    </div>
  )
}
