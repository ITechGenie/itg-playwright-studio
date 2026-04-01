import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Server, Layers, Key } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/services/api-client"

type Attribute = { key: string; type: string; scope: string; description: string }
type Template = { id: string; name: string; attributes: Attribute[] }
type Dataset = { id: string; name: string }
type Environment = { id: string; name: string; templateId: string; variables: string; datasets: Dataset[] }

export default function DataEnvironments() {
  const { id } = useParams()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  // Env Form
  const [openEnv, setOpenEnv] = useState(false)
  const [envName, setEnvName] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [envVars, setEnvVars] = useState<Record<string, string>>({})

  // Dataset Form
  const [openSet, setOpenSet] = useState<{ envId: string, templateId: string } | null>(null)
  const [setName, setSetName] = useState("")
  const [setVars, setSetVars] = useState<Record<string, string>>({})

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  async function fetchData() {
    try {
      const [envRes, tplRes] = await Promise.all([
        apiClient.getDataEnvironments(id!),
        apiClient.getDataTemplates(id!)
      ])
      setEnvironments(envRes)
      setTemplates(tplRes)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleCreateEnv() {
    try {
      await apiClient.createDataEnvironment(id!, { 
        name: envName, 
        templateId: selectedTemplate, 
        variables: envVars 
      })
      setOpenEnv(false); setEnvName(""); setSelectedTemplate(""); setEnvVars({})
      fetchData()
    } catch (e) { console.error(e) }
  }

  async function handleCreateSet() {
    if (!openSet) return
    try {
      await apiClient.createDataSet(id!, openSet.envId, { 
        name: setName, 
        variables: setVars 
      })
      setOpenSet(null); setSetName(""); setSetVars({})
      fetchData()
    } catch (e) { console.error(e) }
  }

  const getActiveTemplate = (tid: string) => templates.find(t => t.id === tid)

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Environments & Data Sets</h1>
          <p className="text-muted-foreground">Manage your test configuration permutations.</p>
        </div>
        
        <Dialog open={openEnv} onOpenChange={setOpenEnv}>
          <DialogTrigger asChild>
            <Button><Server className="size-4 mr-2" /> New Environment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Environment</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Environment Name</Label>
                <Input value={envName} onChange={(e) => setEnvName(e.target.value)} placeholder="e.g. Stage" />
              </div>
              <div className="grid gap-2">
                <Label>Base Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select a schema template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedTemplate && getActiveTemplate(selectedTemplate)?.attributes.filter(a => a.scope === "environment").length! > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Environment Variables</h4>
                  {getActiveTemplate(selectedTemplate)?.attributes.filter(a => a.scope === "environment").map(attr => (
                    <div key={attr.key} className="grid gap-2 mb-4">
                      <Label className="flex items-center gap-2">
                        {attr.key} 
                        {attr.type === "secret" && <Key className="size-3 text-muted-foreground" />}
                      </Label>
                      <Input 
                        type={attr.type === "secret" ? "password" : "text"}
                        placeholder={attr.description || attr.type}
                        value={envVars[attr.key] || ""}
                        onChange={(e) => setEnvVars({ ...envVars, [attr.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={handleCreateEnv} disabled={!envName || !selectedTemplate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {environments.map(env => (
          <Card key={env.id}>
            <CardHeader className="flex flex-row justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 mb-1">
                  <Server className="text-primary size-5" /> {env.name}
                </CardTitle>
                <CardDescription>Using template: {getActiveTemplate(env.templateId)?.name || env.templateId}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenSet({ envId: env.id, templateId: env.templateId })}>
                <Plus className="size-4 mr-1" /> Add Data Set
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Tabs defaultValue="datasets" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="datasets">Data Sets ({env.datasets.length})</TabsTrigger>
                    <TabsTrigger value="envvars">Environment Variables</TabsTrigger>
                  </TabsList>
                  <TabsContent value="datasets">
                    {env.datasets.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-6 text-center border rounded-md">
                        No data sets created for this environment yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {env.datasets.map(ds => (
                          <div key={ds.id} className="p-4 rounded-md border bg-secondary/10 flex items-center justify-between">
                            <span className="font-medium flex items-center gap-2">
                              <Layers className="size-4 text-muted-foreground" />
                              {ds.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="envvars">
                    <div className="bg-secondary/10 rounded-md p-4 space-y-2">
                      <pre className="text-xs">{JSON.stringify(JSON.parse(env.variables || "{}"), null, 2)}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        ))}
        {environments.length === 0 && (
          <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No environments configured. Let's set up a new environment!
          </div>
        )}
      </div>

      {/* Dataset Dialog */}
      <Dialog open={!!openSet} onOpenChange={(val) => !val && setOpenSet(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Data Set</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Data Set Name</Label>
              <Input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="e.g. Admin User Role" />
            </div>
            {openSet && getActiveTemplate(openSet.templateId)?.attributes.filter(a => a.scope === "dataset").length! > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Dataset Variables</h4>
                {getActiveTemplate(openSet.templateId)?.attributes.filter(a => a.scope === "dataset").map(attr => (
                  <div key={attr.key} className="grid gap-2 mb-4">
                    <Label className="flex items-center gap-2">
                      {attr.key} 
                      {attr.type === "secret" && <Key className="size-3 text-muted-foreground" />}
                    </Label>
                    <Input 
                      type={attr.type === "secret" ? "password" : "text"}
                      placeholder={attr.description || attr.type}
                      value={setVars[attr.key] || ""}
                      onChange={(e) => setSetVars({ ...setVars, [attr.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={handleCreateSet} disabled={!setName}>Create Data Set</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
