import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Server, Layers, Key, ArrowLeft, Search, Copy, Eye, Info, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"

type Attribute = { key: string; type: string; scope: string; description: string }
type Template = { id: string; name: string; attributes: Attribute[] }
type Dataset = { id: string; name: string; variables?: string }
type Environment = { id: string; name: string; templateId: string; variables: string; datasets: Dataset[] }

type ViewState = "LIST" | "DETAILS" | "CREATE_ENV" | "CREATE_SET"

export default function DataEnvironments() {
  const { id: projectId } = useParams<{ id: string }>()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [view, setView] = useState<ViewState>("LIST")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Selection
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [datasetSearch, setDatasetSearch] = useState("")
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(new Set())
  const [datasetCache, setDatasetCache] = useState<Record<string, string>>({})
  const [loadingDatasets, setLoadingDatasets] = useState<Set<string>>(new Set())
  
  // Forms
  const [envName, setEnvName] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [setName, setSetName] = useState("")
  const [setVars, setSetVars] = useState<Record<string, string>>({})

  useEffect(() => {
    if (projectId) fetchData()
  }, [projectId])

  async function fetchData() {
    try {
      setLoading(true)
      const [envRes, tplRes] = await Promise.all([
        apiClient.getDataEnvironments(projectId!),
        apiClient.getDataTemplates(projectId!)
      ])
      setEnvironments(envRes)
      setTemplates(tplRes)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEnv() {
    try {
      await apiClient.createDataEnvironment(projectId!, { 
        name: envName, 
        templateId: selectedTemplateId, 
        variables: envVars 
      })
      resetForms(); setView("LIST"); fetchData()
    } catch (e) { console.error(e) }
  }

  async function handleCreateSet() {
    if (!selectedEnv) return
    try {
      await apiClient.createDataSet(projectId!, selectedEnv.id, { 
        name: setName, 
        variables: setVars 
      })
      resetForms(); setView("DETAILS"); 
      fetchEnvironmentDetails(selectedEnv.id)
    } catch (e) { console.error(e) }
  }

  function resetForms() {
    setEnvName(""); setSelectedTemplateId(""); setEnvVars({}); setSetName(""); setSetVars({})
  }

  const fetchEnvironmentDetails = async (envId: string, nextView: ViewState = "DETAILS", isDuplicate = false) => {
    try {
      setLoading(true)
      const details = await apiClient.getDataEnvironment(projectId!, envId)
      setSelectedEnv(details)
      setExpandedDatasets(new Set())
      setDatasetCache({})
      
      if (isDuplicate) {
        setEnvName(`${details.name} (Copy)`)
        setSelectedTemplateId(details.templateId)
        setEnvVars(JSON.parse(details.variables || "{}"))
        setView("CREATE_ENV")
      } else {
        setView(nextView)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleDataset = async (dsId: string) => {
    const newExpanded = new Set(expandedDatasets)
    if (newExpanded.has(dsId)) {
      newExpanded.delete(dsId)
    } else {
      newExpanded.add(dsId)
      if (!datasetCache[dsId] && selectedEnv) {
        try {
          setLoadingDatasets(prev => new Set(prev).add(dsId))
          const dsDetails = await apiClient.getDataSet(projectId!, selectedEnv.id, dsId)
          setDatasetCache(prev => ({ ...prev, [dsId]: dsDetails.variables }))
        } catch (e) {
          console.error(e)
        } finally {
          setLoadingDatasets(prev => {
            const n = new Set(prev); n.delete(dsId); return n
          })
        }
      }
    }
    setExpandedDatasets(newExpanded)
  }

  const getTemplate = (tid: string) => templates.find(t => t.id === tid)
  const currentTemplate = selectedTemplateId ? getTemplate(selectedTemplateId) : null
  const selectedEnvTemplate = selectedEnv ? getTemplate(selectedEnv.templateId) : null

  const filteredEnvs = environments.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredDatasets = selectedEnv?.datasets?.filter(ds => 
    ds.name.toLowerCase().includes(datasetSearch.toLowerCase())
  ) || []

  const VariableRenderer = ({ variables, template }: { variables: string, template: Template | undefined }) => {
    const vars = JSON.parse(variables || "{}")
    if (Object.keys(vars).length === 0) return <div className="p-8 text-center text-zinc-600 italic text-xs border border-dashed border-zinc-800 rounded-xl">No variables defined.</div>
    
    return (
      <div className="grid gap-2">
        {Object.entries(vars).map(([key, val]) => {
          const attr = template?.attributes.find(a => a.key === key)
          return (
            <div key={key} className="flex items-center gap-4 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-900 shadow-sm transition-all group">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-blue-400">{key}</span>
                  {attr?.type === "secret" && <Key className="size-3 text-zinc-600" />}
                </div>
                {attr?.description && <p className="text-[9px] text-zinc-600 italic truncate max-w-[300px]">{attr.description}</p>}
              </div>
              <div className="flex items-center gap-3">
                 <div className="px-3 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-400 min-w-[180px]">
                    {attr?.type === "secret" ? "••••••••••••" : String(val)}
                 </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title="Environments & Data Sets" 
        description="Manage your test configuration, environments, and data set overrides."
        action={view === "LIST" && (
          <Button 
            size="lg" 
            onClick={() => { resetForms(); setView("CREATE_ENV"); }}
            className="h-11 bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 transition-all px-6"
          >
            <Plus className="size-5 mr-2" /> New Environment
          </Button>
        )}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {view === "LIST" ? (
          <>
            <div className="flex items-center gap-4 max-w-md mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input 
                  placeholder="Search environments..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-blue-500 text-sm h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {filteredEnvs.map(env => (
                <Card key={env.id} className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden flex flex-col">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-3 text-white">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Server className="size-5 text-blue-500" />
                      </div>
                      <span className="truncate">{env.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500 font-medium">
                      Schema: <span className="text-zinc-400">{getTemplate(env.templateId)?.name || "Unknown"}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end gap-5">
                    <div className="flex items-center justify-between">
                       <Badge variant="outline" className="bg-zinc-900 text-[10px] text-zinc-400 border-zinc-800 px-2 py-0.5 font-bold">
                          {env.datasets?.length || 0} DATA SETS
                       </Badge>
                       <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => fetchEnvironmentDetails(env.id, "DETAILS", true)}
                          className="h-8 w-8 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10"
                          title="Duplicate environment"
                         >
                            <Copy className="size-3.5" />
                         </Button>
                         <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => fetchEnvironmentDetails(env.id)}
                          className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800 shadow-md"
                          title="View Details"
                         >
                            <Eye className="size-3.5" />
                         </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredEnvs.length === 0 && !loading && (
                <div className="col-span-full border border-dashed border-zinc-800 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-zinc-900/10">
                  <Server className="size-10 text-zinc-700 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-white mb-1">No environments found</h3>
                  <p className="text-zinc-500 text-sm max-w-xs">{searchTerm ? `No matches for "${searchTerm}"` : "Setup an environment to manage your data."}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setView("LIST"); resetForms(); }} className="text-zinc-400 hover:text-white -ml-2 h-9">
                <ArrowLeft className="size-4 mr-2" /> Back to list
              </Button>
            </div>

            {view === "DETAILS" && selectedEnv ? (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                       <div className="p-2 bg-blue-500/10 rounded-xl"><Server className="size-6 text-blue-500" /></div>
                       {selectedEnv.name}
                    </h2>
                    <p className="text-sm text-zinc-500 pl-14">
                      Implementing schema: <Badge variant="outline" className="border-zinc-800 text-zinc-400 font-bold ml-1">{selectedEnvTemplate?.name || "Unknown"}</Badge>
                    </p>
                  </div>
                  <Button 
                    onClick={() => { resetForms(); setView("CREATE_SET"); }}
                    className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-6 shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="size-4 mr-2" /> New Data Set
                  </Button>
                </div>

                <Tabs defaultValue="envvars" className="w-full">
                  <TabsList className="bg-zinc-900/50 border border-zinc-800 h-11 p-1 mb-8">
                    <TabsTrigger value="envvars" className="h-9 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                      Environment Variables
                    </TabsTrigger>
                    <TabsTrigger value="datasets" className="h-9 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                      Data Sets ({selectedEnv.datasets?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="envvars" className="mt-0 ring-offset-zinc-950">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 text-zinc-500">
                         <Info className="size-4" />
                         <span className="text-[11px] font-bold uppercase tracking-widest">Global Environment Scope</span>
                      </div>
                      <VariableRenderer variables={selectedEnv.variables} template={selectedEnvTemplate || undefined} />
                    </div>
                  </TabsContent>

                  <TabsContent value="datasets" className="mt-0 ring-offset-zinc-950 space-y-6">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                      <Input 
                        placeholder="Search data sets..." 
                        value={datasetSearch}
                        onChange={(e) => setDatasetSearch(e.target.value)}
                        className="pl-10 bg-zinc-900/50 border-zinc-800 h-10 text-sm focus:ring-blue-500"
                      />
                    </div>

                    {filteredDatasets.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/5">
                        <Layers className="size-10 text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-600 text-sm">{datasetSearch ? "No data sets match your search." : "No specific data sets found for this environment."}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredDatasets.map(ds => {
                          const isExpanded = expandedDatasets.has(ds.id)
                          const isLoading = loadingDatasets.has(ds.id)
                          return (
                            <div key={ds.id} className="border border-zinc-800 rounded-xl bg-zinc-950/20 overflow-hidden transition-all hover:border-zinc-700">
                              <button 
                                onClick={() => toggleDataset(ds.id)}
                                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-zinc-900/50 transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="size-4 text-blue-500" /> : <ChevronRight className="size-4 text-zinc-600" />}
                                <div className="p-1.5 bg-zinc-900 rounded-md border border-zinc-800">
                                  <Layers className="size-3.5 text-zinc-400" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-sm font-bold text-zinc-200">{ds.name}</h4>
                                </div>
                                {isExpanded && isLoading && <Loader2 className="size-4 animate-spin text-blue-500" />}
                              </button>
                              
                              {isExpanded && (
                                <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2 duration-200">
                                  {isLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                                      <Loader2 className="size-5 animate-spin" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest">Loading variables...</span>
                                    </div>
                                  ) : (
                                    <VariableRenderer variables={datasetCache[ds.id] || "{}"} template={selectedEnvTemplate || undefined} />
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (view === "CREATE_ENV" || view === "CREATE_SET") && (
              <div className="space-y-8 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-bold text-white">
                  {view === "CREATE_ENV" ? "Setup New Environment" : `New Data Set for ${selectedEnv?.name}`}
                </h2>

                <div className="grid gap-8 bg-zinc-950/40 border border-zinc-800 p-8 rounded-3xl">
                  <div className="grid gap-3">
                    <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">{view === "CREATE_ENV" ? "Environment Name" : "Data Set Name"}</Label>
                    <Input 
                      value={view === "CREATE_ENV" ? envName : setName} 
                      onChange={(e) => view === "CREATE_ENV" ? setEnvName(e.target.value) : setSetName(e.target.value)} 
                      placeholder={view === "CREATE_ENV" ? "e.g. Production / QA-North" : "e.g. Premium User / Admin Flow"} 
                      className="bg-zinc-900 border-zinc-800 h-11 text-lg font-bold focus:ring-blue-500"
                    />
                  </div>

                  {view === "CREATE_ENV" && (
                    <div className="grid gap-3">
                      <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Base Schema Template</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11 text-lg font-medium">
                          <SelectValue placeholder="Select a schema template" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                          {templates.map(t => <SelectItem key={t.id} value={t.id} className="h-10">{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(currentTemplate || (view === "CREATE_SET" && selectedEnvTemplate)) && (
                    <div className="pt-4 space-y-6">
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest whitespace-nowrap">Config Variables</Label>
                        <div className="h-px w-full bg-zinc-900" />
                      </div>
                      <div className="space-y-5">
                       {(view === "CREATE_ENV" ? currentTemplate : selectedEnvTemplate)?.attributes
                        .filter(a => a.scope === (view === "CREATE_ENV" ? "environment" : "dataset")).map(attr => (
                          <div key={attr.key} className="grid grid-cols-12 gap-4 items-center">
                            <Label className="col-span-12 md:col-span-4 flex items-center gap-2 text-sm font-bold text-zinc-400">
                              <span className="font-mono text-xs">{attr.key}</span>
                              {attr.type === "secret" && <Key className="size-3 text-blue-500" />}
                            </Label>
                            <div className="col-span-12 md:col-span-8">
                              <Input 
                                type={attr.type === "secret" ? "password" : "text"}
                                placeholder={attr.description || attr.type}
                                value={(view === "CREATE_ENV" ? envVars[attr.key] : setVars[attr.key]) || ""}
                                onChange={(e) => view === "CREATE_ENV" 
                                  ? setEnvVars({ ...envVars, [attr.key]: e.target.value })
                                  : setSetVars({ ...setVars, [attr.key]: e.target.value })
                                }
                                className="bg-zinc-900/50 border-zinc-800 h-10 text-sm focus:border-blue-500/50"
                              />
                            </div>
                          </div>
                      ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    size="lg" 
                    onClick={view === "CREATE_ENV" ? handleCreateEnv : handleCreateSet}
                    disabled={view === "CREATE_ENV" ? (!envName || !selectedTemplateId) : !setName}
                    className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-10 shadow-lg shadow-blue-600/10"
                  >
                    {view === "CREATE_ENV" ? "Create Environment" : "Save Data Set"}
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setView(view === "CREATE_SET" ? "DETAILS" : "LIST")} className="h-11 text-zinc-500 hover:text-white px-8">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
