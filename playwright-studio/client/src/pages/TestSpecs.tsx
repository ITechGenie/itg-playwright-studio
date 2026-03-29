import { useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { FileManager } from "@/components/file-manager"
import { TestRunnerPanel } from "@/components/test-runner-panel"
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadIcon, PlayIcon, Settings2Icon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function TestSpecs() {
  const { id: projectId = "1" } = useParams();

  // runnerTarget: undefined = panel closed, "" = run all, "path/to/file" = specific target
  const [runnerTarget, setRunnerTarget] = useState<string | undefined>(undefined);
  
  // Test configuration
  const [browser, setBrowser] = useState<string>("chromium");
  const [width, setWidth] = useState<string>("1280");
  const [height, setHeight] = useState<string>("720");
  const [baseURL, setBaseURL] = useState<string>("http://localhost:5173");
  const [video, setVideo] = useState<string>("retain-on-failure");
  const [screenshot, setScreenshot] = useState<string>("only-on-failure");

  const openRunner = (target: string) => setRunnerTarget(target);
  const closeRunner = () => setRunnerTarget(undefined);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── File Explorer ── */}
      <div className="flex-1 overflow-hidden">
        <FileManager
          title="Scripts explorer"
          onRunFile={openRunner}
          actions={
            <>
              <Button variant="outline" size="sm">
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button variant="outline" size="sm">Add Spec</Button>
              
              {/* Test Configuration Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2Icon className="mr-2 h-4 w-4" />
                    Config
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Test Configuration</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="browser" className="text-xs">Browser</Label>
                      <Select value={browser} onValueChange={setBrowser}>
                        <SelectTrigger id="browser" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chromium">Chromium</SelectItem>
                          <SelectItem value="chrome">Chrome</SelectItem>
                          <SelectItem value="firefox">Firefox</SelectItem>
                          <SelectItem value="webkit">WebKit</SelectItem>
                          <SelectItem value="edge">Edge</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="width" className="text-xs">Width</Label>
                        <Input 
                          id="width"
                          type="number" 
                          value={width} 
                          onChange={(e) => setWidth(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height" className="text-xs">Height</Label>
                        <Input 
                          id="height"
                          type="number" 
                          value={height} 
                          onChange={(e) => setHeight(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="baseURL" className="text-xs">Base URL</Label>
                      <Input 
                        id="baseURL"
                        type="url" 
                        value={baseURL} 
                        onChange={(e) => setBaseURL(e.target.value)}
                        className="h-8 text-xs"
                        placeholder="http://localhost:5173"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="video" className="text-xs">Video Recording</Label>
                      <Select value={video} onValueChange={setVideo}>
                        <SelectTrigger id="video" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="on">On</SelectItem>
                          <SelectItem value="retain-on-failure">On Failure</SelectItem>
                          <SelectItem value="on-first-retry">On Retry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="screenshot" className="text-xs">Screenshots</Label>
                      <Select value={screenshot} onValueChange={setScreenshot}>
                        <SelectTrigger id="screenshot" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="on">On</SelectItem>
                          <SelectItem value="only-on-failure">On Failure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                size="sm"
                className="gap-1.5 bg-green-700 hover:bg-green-600 text-white"
                onClick={() => openRunner("")}
              >
                <PlayIcon className="h-3.5 w-3.5" />
                Run All Tests
              </Button>
            </>
          }
        />
      </div>

      {/* ── Right-sliding Test Runner Drawer ── */}
      <Drawer 
        open={runnerTarget !== undefined} 
        onOpenChange={(open) => !open && closeRunner()}
        direction="right"
        dismissible={false}
        modal={false}
      >
        <DrawerContent>
          <DrawerTitle className="sr-only">Test Runner</DrawerTitle>
          <DrawerDescription className="sr-only">
            Live output from the Playwright test execution.
          </DrawerDescription>
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            {runnerTarget !== undefined && (
              <TestRunnerPanel
                projectId={projectId}
                targetPath={runnerTarget}
                onClose={closeRunner}
                browser={browser}
                width={parseInt(width)}
                height={parseInt(height)}
                baseURL={baseURL}
                video={video}
                screenshot={screenshot}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

