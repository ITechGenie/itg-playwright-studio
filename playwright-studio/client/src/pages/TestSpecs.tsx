import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { FileManager } from "@/components/file-manager"
import { TestRunnerPanel } from "@/components/test-runner-panel"
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadIcon, PlayIcon, Settings2Icon, SaveIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiClient } from "@/services/api-client"

export default function TestSpecs() {
  const { id: projectId } = useParams<{ id: string }>();

  // runnerTarget: undefined = panel closed, "" = run all, "path/to/file" = specific target
  const [runnerTarget, setRunnerTarget] = useState<string | undefined>(undefined);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  
  // Test configuration (loaded from DB)
  const [browser, setBrowser] = useState<string>("chromium");
  const [width, setWidth] = useState<string>("1280");
  const [height, setHeight] = useState<string>("720");
  const [baseURL, setBaseURL] = useState<string>("http://localhost:5173");
  const [video, setVideo] = useState<string>("retain-on-failure");
  const [screenshot, setScreenshot] = useState<string>("only-on-failure");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    
    // Fetch project to get its config
    apiClient.getProjects().then((projects: any[]) => {
      const proj = projects.find(p => p.id === projectId);
      if (proj && proj.config) {
        setBrowser(proj.config.browser || "chromium");
        setWidth(String(proj.config.viewportWidth || "1280"));
        setHeight(String(proj.config.viewportHeight || "720"));
        setBaseURL(proj.config.baseUrl || "http://localhost:5173");
        setVideo(proj.config.video || "retain-on-failure");
        setScreenshot(proj.config.screenshot || "only-on-failure");
      }
    });
  }, [projectId]);

  const handleSaveConfig = async () => {
    if (!projectId) return;
    setIsUpdating(true);
    try {
      await apiClient.updateProjectConfig(projectId, {
        browser,
        viewportWidth: parseInt(width),
        viewportHeight: parseInt(height),
        baseUrl: baseURL,
        video,
        screenshot
      });
    } catch (err) {
      console.error("Failed to save config", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const openRunner = (target: string) => setRunnerTarget(target);
  const closeRunner = () => setRunnerTarget(undefined);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-hidden">
        <FileManager
          title="Scripts explorer"
          onRunFile={openRunner}
          onSelectionChange={setSelectedPaths}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <UploadIcon className="mr-2 h-3.5 w-3.5" />
                Upload
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">Add Spec</Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Settings2Icon className="mr-2 h-3.5 w-3.5" />
                    Config
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Test Configuration</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="browser" className="text-[10px] uppercase font-bold text-zinc-500">Browser</Label>
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
                        <Label htmlFor="width" className="text-[10px] uppercase font-bold text-zinc-500">Width</Label>
                        <Input 
                          id="width"
                          type="number" 
                          value={width} 
                          onChange={(e) => setWidth(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height" className="text-[10px] uppercase font-bold text-zinc-500">Height</Label>
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
                      <Label htmlFor="baseURL" className="text-[10px] uppercase font-bold text-zinc-500">Base URL</Label>
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
                      <Label htmlFor="video" className="text-[10px] uppercase font-bold text-zinc-500">Video Recording</Label>
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
                      <Label htmlFor="screenshot" className="text-[10px] uppercase font-bold text-zinc-500">Screenshots</Label>
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

                    <Button className="w-full h-8 text-xs" onClick={handleSaveConfig} disabled={isUpdating}>
                       {isUpdating ? "Saving..." : "Save Persistence"}
                       {!isUpdating && <SaveIcon className="ml-2 h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-green-700 hover:bg-green-600 text-white font-bold"
                onClick={() => openRunner(selectedPaths.length > 0 ? "SELECTED" : "")}
              >
                <PlayIcon className="h-3.5 w-3.5" />
                {selectedPaths.length > 0 ? `Run Selected (${selectedPaths.length})` : "Run All"}
              </Button>
            </>
          }
        />
      </div>

      <Drawer 
        open={runnerTarget !== undefined} 
        onOpenChange={(open) => !open && closeRunner()}
        direction="right"
        dismissible={false}
        modal={false}
      >
        <DrawerContent className="w-[90vw] sm:max-w-none">
          <DrawerTitle className="sr-only">Test Runner</DrawerTitle>
          <DrawerDescription className="sr-only">
            Live output from the Playwright test execution.
          </DrawerDescription>
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            {runnerTarget !== undefined && projectId && (
              <TestRunnerPanel
                projectId={projectId}
                targetPath={runnerTarget === "SELECTED" ? undefined : runnerTarget}
                targetPaths={runnerTarget === "SELECTED" ? selectedPaths : undefined}
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
