import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error("Failed to fetch projects", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-6xl px-6 py-12 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome, Developer!</h1>
          <p className="text-muted-foreground">Select a project workspace to get started</p>
          <div className="w-full max-w-lg mt-6">
            <Input type="text" placeholder="Search projects..." className="w-full" />
          </div>
        </div>

        <div className="rounded-md border bg-card relative">
          {loading && (
             <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
             </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace Path</TableHead>
                <TableHead>Project Grouper</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
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
                <TableRow key={proj.id}>
                  <TableCell className="font-medium text-primary">{proj.name}</TableCell>
                  <TableCell>{proj.grouper}</TableCell>
                  <TableCell>{proj.status}</TableCell>
                  <TableCell>{proj.createdBy}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/app/project/${proj.id}/specs`)}>
                      Open Explorer
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
