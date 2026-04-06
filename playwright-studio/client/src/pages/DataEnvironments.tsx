import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Server, Key, ArrowLeft, Search, Pencil, Trash2, Info, Layers, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

type Attribute = { key: string; type: string; scope: string; description: string; defaultValue?: string }
type Template = { id: string; name: string; attributes: Attribute[] }
type Dataset = { id: string; name: string; variables?: string }
type Environment = { id: string; name: string; templateId: string; variables: string; datasets: Dataset[] }
type ViewState = "LIST" | "DETAILS" | "CREATE" | "EDIT"

export default function DataEnvironments() {
  const { id: projectId } = useParams<{ id: string }>()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([])
  const [view, setView] = useState<ViewState>("LIST")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [templateCache, setTemplateCache] = useState<Record<string, Template>>({})
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(new Set())
  const [datasetVarCache, setDatasetVarCache] = useState<Record<string, string>>({})
  const [loadingDatasets, setLoadingDatasets] = useState<Set<string>>(new Set())
  const [datasetSearch, setDatasetSearch] = useState("")

  // Form state
  const [envName, setEnvName] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [linkedDatasetIds, setLinkedDatasetIds] = useState<Set<string>>(new Set())

  useEffect(() => { if (projectId) fetchData() }, [projectId])

  async function fetchData() {
    try {
      setLoading(true)
      const [envRes, tplRes] = await Promise.all([
        apiClient.getDataEnvironments(projectId!),
        apiClient.getDataTemplates(projectId!)
      ])
      setEnvironments(envRes)
      setTemplates(tplRes)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function getFullTemplate(templateId: string): Promise<Template> {
    if (templateCache[templateId]) return templateCache[templateId]
    const t = await apiClient.getDataTemplate(projectId!, templateId)
    setTemplateCache(prev => ({ ...prev, [templateId]: t }))
    return t
  }

  async function openCreate() {
    resetForm(); setView("CREATE")
  }

  async function openEdit(env: Environment) {
    try {
      setLoading(true)
      const [details] = await Promise.all([
        apiClient.getDataEnvironment(projectId!, env.id),
        getFullTemplate(env.templateId)
      ])
      setSelectedEnv(details)
      setEnvName(details.name)
      setSelectedTemplateId(details.templateId)
      const vars = JSON.parse(details.variables || '{}')
      for (const k in vars) { if (vars[k] === 'REDACTED') vars[k] = '' }
      setEnvVars(vars)
      setLinkedDatasetIds(new Set(details.datasets.map((d: Dataset) => d.id)))
      // Load datasets for this template
      const ds = await apiClient.getDataSets(projectId!, details.templateId)
      setAllDatasets(ds)
      setView("EDIT")
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function openDetails(envId: string) {
    try {
      setLoading(true)
      const details = await apiClient.getDataEnvironment(projectId!, envId)
      setSelectedEnv(details)
      setExpandedDatasets(new Set())
      setDatasetVarCache({})
      setDatasetSearch("")
      await getFullTemplate(details.templateId)
      setView("DETAILS")
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function toggleDataset(dsId: string) {
    const next = new Set(expandedDatasets)
    if (next.has(dsId)) {
      next.delete(dsId)
    } else {
      next.add(dsId)
      if (!datasetVarCache[dsId] && selectedEnv) {
        try {
          setLoadingDatasets(prev => new Set(prev).add(dsId))
          const details = await apiClient.getDataSetV2(projectId!, dsId)
          setDatasetVarCache(prev => ({ ...prev, [dsId]: details.variables }))
        } catch (e) { console.error(e) }
        finally {
          setLoadingDatasets(prev => { const s = new Set(prev); s.delete(dsId); return s })
        }
      }
    }
    setExpandedDatasets(next)
  }

  async function handleSave() {
    try {
      if (view === "EDIT" && selectedEnv) {
        await apiClient.updateDataEnvironment(projectId!, selectedEnv.id, { name: envName, variables: envVars })
        await apiClient.updateEnvDatasetLinks(projectId!, selectedEnv.id, Array.from(linkedDatasetIds))
      } else {
        const created = await apiClient.createDataEnvironment(projectId!, { name: envName, templateId: selectedTemplateId, variables: envVars })
        await apiClient.updateEnvDatasetLinks(projectId!, created.id, Array.from(linkedDatasetIds))
      }
      resetForm(); setView("LIST"); fetchData()
    } catch (e) { console.error(e) }
  }

  async function handleDelete(envId: string) {
    try { await apiClient.deleteDataEnvironment(projectId!, envId); setDeletingId(null); fetchData() }
    catch (e) { console.error(e) }
  }

  async function onTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId)
    setEnvVars({})
    setLinkedDatasetIds(new Set())
    await Promise.all([
      getFullTemplate(templateId),
      apiClient.getDataSets(projectId!, templateId).then(setAllDatasets)
    ])
  }

  function resetForm() {
    setEnvName(""); setSelectedTemplateId(""); setEnvVars({}); setLinkedDatasetIds(new Set()); setSelectedEnv(null); setAllDatasets([])
  }

  const getTemplate = (tid: string) => templateCache[tid] || templates.find(t => t.id === tid)
  const currentTemplate = selectedTemplateId ? getTemplate(selectedTemplateId) : null
  const selectedEnvTemplate = selectedEnv ? getTemplate(selectedEnv.templateId) : null
  const filtered = environments.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const VariableRenderer = ({ variables, template }: { variables: string; template: Template | undefined }) => {
    const vars = JSON.parse(variables || '{}')
    if (!Object.keys(vars).length) return (
      <div className="p-8 text-center text-zinc-600 italic text-xs border border-dashed border-zinc-800 rounded-xl">No variables defined.</div>
    )
    return (
      <div className="grid gap-2">
        {Object.entries(vars).map(([key, val]) => {
          const attr = template?.attributes.find(a => a.key === key)
          return (
            <div key={key} className="flex items-center gap-4 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-900 transition-all">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-blue-400">{key}</span>
                  {attr?.type === "secret" && <Key className="size-3 text-zinc-600" />}
                </div>
                {attr?.description && <p className="text-[9px] text-zinc-600 italic">{attr.description}</p>}
              </div>
              <div className="px-3 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-400 min-w-[180px]">
                {attr?.type === "secret" ? "••••••••••••" : String(val)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader title="Environments"
        description="Manage test environments and their variable values."
        action={view === "LIST" && (
          <Button size="lg" onClick={openCreate} className="h-11 bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 px-6">
            <Plus className="size-5 mr-2" /> New Environment
          </Button>
        )} />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {view === "LIST" ? (
          <>
            <div className="relative max-w-md mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <Input placeholder="Search environments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 text-sm h-10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {filtered.map(env => (
                <Card key={env.id} onClick={() => openDetails(env.id)}
                  className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden flex flex-col cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0"><Server className="size-4 text-blue-500" /></div>
                      <span className="truncate">{env.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Schema: <span className="text-zinc-400">{getTemplate(env.templateId)?.name || "—"}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(env)}
                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800" title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      {deletingId === env.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(env.id)}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold">Confirm</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}
                            className="h-7 px-2 text-zinc-500 hover:text-white text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(env.id)}
                          className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10" title="Delete">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="col-span-full border border-dashed border-zinc-800 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-zinc-900/10">
                  <Server className="size-10 text-zinc-700 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-white mb-1">No environments found</h3>
                  <p className="text-zinc-500 text-sm">{searchTerm ? `No matches for "${searchTerm}"` : "Create an environment to get started."}</p>
                </div>
              )}
            </div>
          </>
        ) : view === "DETAILS" && selectedEnv ? (
          <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setView("LIST")} className="text-zinc-400 hover:text-white -ml-2 h-9">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Button>
            </div>
            <div className="flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl"><Server className="size-6 text-blue-500" /></div>
                  {selectedEnv.name}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800"
                    onClick={() => openEdit(selectedEnv)}><Pencil className="size-3.5" /></Button>
                </h2>
                <p className="text-sm text-zinc-500 pl-14">
                  Schema: <Badge variant="outline" className="border-zinc-800 text-zinc-400 font-bold ml-1">{selectedEnvTemplate?.name || "—"}</Badge>
                </p>
              </div>
            </div>
            <Tabs defaultValue="envvars" className="w-full">
              <TabsList className="bg-zinc-900/50 border border-zinc-800 h-11 p-1 mb-8">
                <TabsTrigger value="envvars" className="h-9 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                  Environment Variables
                </TabsTrigger>
                <TabsTrigger value="datasets" className="h-9 px-8 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-bold text-xs uppercase tracking-wider">
                  Linked Data Sets ({selectedEnv.datasets?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="envvars">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 text-zinc-500">
                    <Info className="size-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Global Environment Scope</span>
                  </div>
                  <VariableRenderer variables={selectedEnv.variables} template={selectedEnvTemplate ?? undefined} />
                </div>
              </TabsContent>
              <TabsContent value="datasets" className="space-y-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <Input placeholder="Search data sets..." value={datasetSearch}
                    onChange={e => setDatasetSearch(e.target.value)}
                    className="pl-10 bg-zinc-900/50 border-zinc-800 h-10 text-sm" />
                </div>
                {(() => {
                  const filteredDs = (selectedEnv.datasets || []).filter(ds =>
                    ds.name.toLowerCase().includes(datasetSearch.toLowerCase())
                  )
                  if (filteredDs.length === 0) return (
                    <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/5">
                      <Layers className="size-10 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-600 text-sm">
                        {datasetSearch ? "No data sets match your search." : "No data sets linked to this environment."}
                      </p>
                      {!datasetSearch && (
                        <Button variant="outline" size="sm" className="mt-4 border-zinc-700" onClick={() => openEdit(selectedEnv)}>
                          Link Data Sets
                        </Button>
                      )}
                    </div>
                  )
                  return (
                    <div className="space-y-3">
                      {filteredDs.map(ds => {
                        const isExpanded = expandedDatasets.has(ds.id)
                        const isLoading = loadingDatasets.has(ds.id)
                        return (
                          <div key={ds.id} className="border border-zinc-800 rounded-xl bg-zinc-950/20 overflow-hidden transition-all hover:border-zinc-700">
                            <button onClick={() => toggleDataset(ds.id)}
                              className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-zinc-900/50 transition-colors">
                              {isExpanded
                                ? <ChevronDown className="size-4 text-blue-500 shrink-0" />
                                : <ChevronRight className="size-4 text-zinc-600 shrink-0" />}
                              <div className="p-1.5 bg-zinc-900 rounded-md border border-zinc-800 shrink-0">
                                <Layers className="size-3.5 text-zinc-400" />
                              </div>
                              <span className="text-sm font-bold text-zinc-200 flex-1">{ds.name}</span>
                              {isExpanded && isLoading && <Loader2 className="size-4 animate-spin text-blue-500 shrink-0" />}
                            </button>
                            {isExpanded && (
                              <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2 duration-200">
                                {isLoading ? (
                                  <div className="py-10 flex flex-col items-center gap-2 text-zinc-500">
                                    <Loader2 className="size-5 animate-spin" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Loading variables...</span>
                                  </div>
                                ) : (
                                  <VariableRenderer variables={datasetVarCache[ds.id] || "{}"} template={selectedEnvTemplate ?? undefined} />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          </div>
        ) : (view === "CREATE" || view === "EDIT") && (
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setView("LIST"); resetForm() }} className="text-zinc-400 hover:text-white -ml-2">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Button>
              <div className="h-4 w-px bg-zinc-800" />
              <h2 className="text-xl font-bold text-white">{view === "CREATE" ? "New Environment" : "Edit Environment"}</h2>
            </div>

            <div className="grid gap-8 bg-zinc-950/40 border border-zinc-800 p-8 rounded-3xl">
              <div className="grid gap-3">
                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Environment Name</Label>
                <Input value={envName} onChange={e => setEnvName(e.target.value)} placeholder="e.g. Production / QA-North"
                  className="bg-zinc-900 border-zinc-800 h-11 text-lg font-bold" />
              </div>

              <div className="grid gap-3">
                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Base Schema Template</Label>
                <Select value={selectedTemplateId} onValueChange={onTemplateSelect} disabled={view === "EDIT"}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11 text-base font-medium">
                    <SelectValue placeholder="Select a schema template" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {currentTemplate && (
                <>
                  {currentTemplate.attributes.filter(a => a.scope === 'environment').length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest whitespace-nowrap">Environment Variables</Label>
                        <div className="h-px w-full bg-zinc-900" />
                      </div>
                      {currentTemplate.attributes.filter(a => a.scope === 'environment').map(attr => (
                        <div key={attr.key} className="grid grid-cols-12 gap-4 items-center">
                          <Label className="col-span-12 md:col-span-4 flex items-center gap-2 text-sm font-bold text-zinc-400">
                            <span className="font-mono text-xs">{attr.key}</span>
                            {attr.type === "secret" && <Key className="size-3 text-blue-500" />}
                          </Label>
                          <div className="col-span-12 md:col-span-8">
                            <Input type={attr.type === "secret" ? "password" : "text"}
                              placeholder={attr.type === "secret" && view === "EDIT" ? "Leave blank to keep existing" : (attr.description || attr.defaultValue || attr.type)}
                              value={envVars[attr.key] || ""}
                              onChange={e => setEnvVars({ ...envVars, [attr.key]: e.target.value })}
                              className="bg-zinc-900/50 border-zinc-800 h-10 text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {allDatasets.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest whitespace-nowrap">Linked Data Sets</Label>
                        <div className="h-px w-full bg-zinc-900" />
                      </div>
                      <p className="text-xs text-zinc-600">Select which data sets are available in this environment.</p>
                      <div className="space-y-2">
                        {allDatasets.map(ds => (
                          <div key={ds.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all cursor-pointer"
                            onClick={() => setLinkedDatasetIds(prev => {
                              const s = new Set(prev)
                              s.has(ds.id) ? s.delete(ds.id) : s.add(ds.id)
                              return s
                            })}>
                            <Checkbox checked={linkedDatasetIds.has(ds.id)} className="border-zinc-600" />
                            <span className="text-sm font-medium text-zinc-300">{ds.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button size="lg" onClick={handleSave} disabled={!envName || !selectedTemplateId}
                className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-10 shadow-lg shadow-blue-600/10">
                {view === "CREATE" ? "Create Environment" : "Save Changes"}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => { setView("LIST"); resetForm() }}
                className="h-11 text-zinc-500 hover:text-white px-8">Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
