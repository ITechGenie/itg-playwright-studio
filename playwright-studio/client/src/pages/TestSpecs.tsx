import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { FileManager } from "@/components/file-manager"
import { UploadIcon } from "lucide-react"
import allFileItems from "@/data.json"

export default function TestSpecs() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between p-4 border rounded-md bg-card shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch id="headless" />
            <Label htmlFor="headless" className="text-sm font-medium">Headless Mode</Label>
          </div>
          <Button variant="secondary" size="sm">Save Config</Button>
        </div>
      </div>

      <div className="flex-1 rounded-md overflow-hidden">
        <hr />
        <FileManager
          files={allFileItems}
          basePath="/app/project/1/specs"
          title="Scripts explorer"
          actions={
            <>
              <Button variant="outline" size="sm">
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button size="sm">Add Spec</Button>
            </>
          }
        />
      </div>
    </div>
  )
}
