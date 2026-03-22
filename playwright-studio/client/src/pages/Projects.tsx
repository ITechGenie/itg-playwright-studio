import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNavigate } from "react-router-dom"

const MOCK_PROJECTS = [
  { id: 1, name: "Acme Inc E2E", grouper: "Enterprise", createdBy: "Alice", limit: 5, target: 18, status: "Done" },
  { id: 2, name: "Evil Corp Scripts", grouper: "Internal", createdBy: "Bob", limit: 24, target: 29, status: "In Process" }
]

export default function Projects() {
  const navigate = useNavigate();

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

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Project Grouper</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PROJECTS.map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell className="font-medium">{proj.name}</TableCell>
                  <TableCell>{proj.grouper}</TableCell>
                  <TableCell>{proj.status}</TableCell>
                  <TableCell>{proj.createdBy}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/app/project/${proj.id}/specs`)}>
                      View
                    </Button>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <Button variant="outline">Previous</Button>
          <span className="text-sm text-muted-foreground">Page 1 of 1</span>
          <Button variant="outline">Next</Button>
        </div>
      </div>
    </div>
  )
}
