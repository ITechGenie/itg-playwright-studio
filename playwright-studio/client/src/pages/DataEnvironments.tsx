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
import { PageHeader } from "@/components/page-header"

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
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title="Environments & Data Sets" 
        description="Manage your test configuration permutations, environments, and associated data sets."
        action={
          <Dialog open={openEnv} onOpenChange={setOpenEnv}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 transition-all px-6">
                <Server className="size-5 mr-2" /> New Environment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create Environment</DialogTitle>
                <CardDescription>Setup a new environment using a schema template.</CardDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Environment Name</Label>
                  <Input 
                    value={envName} 
                    onChange={(e) => setEnvName(e.target.value)} 
                    placeholder="e.g. Production / Staging" 
                    className="bg-zinc-900 border-zinc-800 h-10 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Base Schema Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10">
                      <SelectValue placeholder="Select a schema template" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedTemplate && getActiveTemplate(selectedTemplate)?.attributes.filter(a => a.scope === "environment").length! > 0 && (
                  <div className="mt-4 pt-6 border-t border-zinc-800">
                    <h4 className="text-xs font-bold uppercase text-zinc-500 mb-4 tracking-widest">Environment Variables</h4>
                    <div className="space-y-4 max-h-[300px] overflow-auto pr-1">
                      {getActiveTemplate(selectedTemplate)?.attributes.filter(a => a.scope === "environment").map(attr => (
                        <div key={attr.key} className="grid gap-2">
                          <Label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                            {attr.key} 
                            {attr.type === "secret" && <Key className="size-3 text-blue-500" />}
                          </Label>
                          <Input 
                            type={attr.type === "secret" ? "password" : "text"}
                            placeholder={attr.description || attr.type}
                            value={envVars[attr.key] || ""}
                            onChange={(e) => setEnvVars({ ...envVars, [attr.key]: e.target.value })}
                            className="bg-zinc-950 border-zinc-800 h-9 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
                <Button variant="ghost" onClick={() => setOpenEnv(false)} className="text-zinc-400">Cancel</Button>
                <Button 
                   onClick={handleCreateEnv} 
                   disabled={!envName || !selectedTemplate}
                   className="bg-blue-600 hover:bg-blue-500 font-bold"
                >
                  Create Environment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-8">
        <div className="grid gap-8 pb-20">
          {environments.map(env => (
            <Card key={env.id} className="border-zinc-800 bg-zinc-950/40 overflow-hidden group">
              <CardHeader className="flex flex-row justify-between items-start border-b border-zinc-800/50 pb-6 bg-zinc-950/20">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold flex items-center gap-3 text-white">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                      <Server className="text-blue-500 size-6 text-glow-sm" /> 
                    </div>
                    {env.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 pl-[52px]">
                    Implementing schema: <span className="text-zinc-400 font-medium">{getActiveTemplate(env.templateId)?.name || env.templateId}</span>
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setOpenSet({ envId: env.id, templateId: env.templateId })}
                  className="border-zinc-700 hover:bg-zinc-900 h-9 px-4 transition-all"
                >
                  <Plus className="size-4 mr-2" /> New Data Set
                </Button>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="space-y-4">
                  <Tabs defaultValue="datasets" className="w-full">
                    <TabsList className="mb-6 bg-zinc-900/50 border border-zinc-800 h-11 p-1">
                      <TabsTrigger value="datasets" className="h-9 px-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                         Data Sets ({env.datasets.length})
                      </TabsTrigger>
                      <TabsTrigger value="envvars" className="h-9 px-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                        Environment Variables
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="datasets" className="mt-0 ring-offset-zinc-950">
                      {env.datasets.length === 0 ? (
                        <div className="text-sm text-zinc-600 p-10 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/5">
                          No data sets defined for {env.name}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {env.datasets.map(ds => (
                            <div 
                              key={ds.id} 
                              className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex flex-col gap-3 group/ds hover:bg-zinc-900/40 hover:border-zinc-700 transition-all cursor-default"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-800 rounded-lg group-hover/ds:bg-blue-500/10 transition-colors">
                                  <Layers className="size-4 text-zinc-500 group-hover/ds:text-blue-400" />
                                </div>
                                <span className="font-bold text-zinc-200 text-sm">{ds.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="envvars" className="mt-0 ring-offset-zinc-950">
                      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 font-mono overflow-auto max-h-[300px]">
                        <pre className="text-xs text-blue-400/80">{JSON.stringify(JSON.parse(env.variables || "{}"), null, 2)}</pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          ))}
          {environments.length === 0 && (
            <div className="p-20 text-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/5">
              <div className="mb-4 flex justify-center">
                <Server className="size-10 text-zinc-700 opacity-50" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Environments Found</h3>
              <p className="max-w-xs mx-auto text-sm">Create an environment to start managing your configuration variables.</p>
              <Button variant="outline" className="mt-8 border-zinc-700" onClick={() => setOpenEnv(true)}>
                Setup first environment
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dataset Dialog */}
      <Dialog open={!!openSet} onOpenChange={(val) => !val && setOpenSet(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create Data Set</DialogTitle>
            <CardDescription>Populate the attributes for this specific data set.</CardDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase text-zinc-400">Data Set Name</Label>
              <Input 
                value={setName} 
                onChange={(e) => setSetName(e.target.value)} 
                placeholder="e.g. Pro User / Admin Role / Default" 
                className="bg-zinc-900 border-zinc-800 h-10 focus:ring-blue-500"
              />
            </div>
            {openSet && getActiveTemplate(openSet.templateId)?.attributes.filter(a => a.scope === "dataset").length! > 0 && (
              <div className="mt-4 pt-6 border-t border-zinc-800">
                <h4 className="text-xs font-bold uppercase text-zinc-500 mb-4 tracking-widest">Data Set Variables</h4>
                <div className="space-y-4 max-h-[300px] overflow-auto pr-1">
                  {getActiveTemplate(openSet.templateId)?.attributes.filter(a => a.scope === "dataset").map(attr => (
                    <div key={attr.key} className="grid gap-2">
                      <Label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                        {attr.key} 
                        {attr.type === "secret" && <Key className="size-3 text-blue-500" />}
                      </Label>
                      <Input 
                        type={attr.type === "secret" ? "password" : "text"}
                        placeholder={attr.description || attr.type}
                        value={setVars[attr.key] || ""}
                        onChange={(e) => setSetVars({ ...setVars, [attr.key]: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setOpenSet(null)} className="text-zinc-400">Cancel</Button>
            <Button 
                onClick={handleCreateSet} 
                disabled={!setName}
                className="bg-blue-600 hover:bg-blue-500 font-bold"
            >
              Create Data Set
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
