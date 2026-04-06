import { useState, useEffect, useRef } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Layers, Key, ArrowLeft, Search, Pencil, Trash2, Upload, Download, Server, FileUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type Attribute = { key: string; type: string; scope: string; description: string; defaultValue?: string }
type Template = { id: string; name: string; attributes: Attribute[] }
type EnvSummary = { id: string; name: string }
type Dataset = { id: string; name: string; templateId: string; variables: string; linkedEnvironments?: EnvSummary[] }
type ViewState = "LIST" | "CREATE" | "EDIT"

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
  return { headers, rows }
}

export default function DataSets() {
  const { id: projectId } = useParams<{ id: string }>()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [environments, setEnvironments] = useState<EnvSummary[]>([])
  const [view, setView] = useState<ViewState>("LIST")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTemplateId, setFilterTemplateId] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [templateCache, setTemplateCache] = useState<Record<string, Template>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null)
  const [dsName, setDsName] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [dsVars, setDsVars] = useState<Record<string, string>>({})
  const [linkedEnvIds, setLinkedEnvIds] = useState<Set<string>>(new Set())

  // CSV import state
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false)
  const [csvPreview, setCsvPreview] = useState<{ name: string; variables: Record<string, string> }[] | null>(null)
  const [csvTemplateId, setCsvTemplateId] = useState("")
  const [csvEnvIds, setCsvEnvIds] = useState<Set<string>>(new Set())

  useEffect(() => { if (projectId) fetchData() }, [projectId])

  async function fetchData() {
    try {
      setLoading(true)
      const [dsRes, tplRes, envRes] = await Promise.all([
        apiClient.getDataSets(projectId!),
        apiClient.getDataTemplates(projectId!),
        apiClient.getDataEnvironments(projectId!)
      ])
      setDatasets(dsRes)
      setTemplates(tplRes)
      setEnvironments(envRes)
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

  async function openEdit(ds: Dataset) {
    try {
      setLoading(true)
      const [details] = await Promise.all([
        apiClient.getDataSetV2(projectId!, ds.id),
        getFullTemplate(ds.templateId)
      ])
      setCurrentDataset(details)
      setDsName(details.name)
      setSelectedTemplateId(details.templateId)
      const vars = JSON.parse(details.variables || '{}')
      for (const k in vars) { if (vars[k] === 'REDACTED') vars[k] = '' }
      setDsVars(vars)
      setLinkedEnvIds(new Set((details.linkedEnvironments || []).map((e: EnvSummary) => e.id)))
      setView("EDIT")
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleSave() {
    try {
      const envIds = Array.from(linkedEnvIds)
      if (view === "EDIT" && currentDataset) {
        await apiClient.updateDataSetV2(projectId!, currentDataset.id, { name: dsName, variables: dsVars, environmentIds: envIds })
      } else {
        await apiClient.createDataSetV2(projectId!, { templateId: selectedTemplateId, name: dsName, variables: dsVars, environmentIds: envIds })
      }
      resetForm(); setView("LIST"); fetchData()
    } catch (e) { console.error(e) }
  }

  async function handleDelete(dsId: string) {
    try { await apiClient.deleteDataSetV2(projectId!, dsId); setDeletingId(null); fetchData() }
    catch (e) { console.error(e) }
  }

  async function onTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId)
    setDsVars({})
    await getFullTemplate(templateId)
  }

  function resetForm() {
    setDsName(""); setSelectedTemplateId(""); setDsVars({}); setLinkedEnvIds(new Set()); setCurrentDataset(null); setCsvPreview(null)
  }

  // CSV download template
  function downloadCsvTemplate(templateId: string) {
    const tpl = templateCache[templateId] || templates.find(t => t.id === templateId)
    if (!tpl) return
    const dsAttrs = tpl.attributes.filter(a => a.scope === 'dataset')
    const headers = ['dataset_name', ...dsAttrs.map(a => a.key)]
    const exampleRow = ['example-dataset-1', ...dsAttrs.map(a => a.defaultValue || '')]
    const csv = [headers.join(','), exampleRow.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${tpl.name}-template.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !csvTemplateId) return
    const tpl = templateCache[csvTemplateId]
    if (!tpl) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)
      const nameIdx = headers.indexOf('dataset_name')
      if (nameIdx === -1) return
      const dsAttrs = tpl.attributes.filter(a => a.scope === 'dataset').map(a => a.key)
      const preview = rows.map(row => {
        const name = row[nameIdx] || 'Unnamed'
        const variables: Record<string, string> = {}
        for (const key of dsAttrs) {
          const idx = headers.indexOf(key)
          if (idx !== -1) variables[key] = row[idx] || ''
        }
        return { name, variables }
      }).filter(r => r.name)
      setCsvPreview(preview)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleBulkImport() {
    if (!csvPreview || !csvTemplateId) return
    try {
      await apiClient.bulkCreateDataSetsV2(projectId!, {
        templateId: csvTemplateId,
        datasets: csvPreview,
        environmentIds: Array.from(csvEnvIds)
      })
      setCsvPreview(null); setCsvTemplateId(""); setCsvEnvIds(new Set())
      setBulkDrawerOpen(false)
      fetchData()
    } catch (e) { console.error(e) }
  }

  const currentTemplate = selectedTemplateId ? (templateCache[selectedTemplateId] || templates.find(t => t.id === selectedTemplateId)) : null

  const filtered = datasets.filter(ds => {
    const matchSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchTemplate = filterTemplateId === "all" || ds.templateId === filterTemplateId
    return matchSearch && matchTemplate
  })

  const getTemplateName = (tid: string) => templates.find(t => t.id === tid)?.name || "—"

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader title="Data Sets"
        description="Manage reusable data sets and map them to one or more environments."
        action={view === "LIST" && (
          <div className="flex items-center gap-3">
            <Button size="lg" variant="outline" onClick={() => setBulkDrawerOpen(true)}
              className="h-11 border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 font-bold px-5">
              <FileUp className="size-4 mr-2" /> Bulk Add
            </Button>
            <Button size="lg" onClick={openCreate} className="h-11 bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 px-6">
              <Plus className="size-5 mr-2" /> New Data Set
            </Button>
          </div>
        )} />

      {/* Bulk Import Drawer */}
      <Sheet open={bulkDrawerOpen} onOpenChange={open => { setBulkDrawerOpen(open); if (!open) { setCsvPreview(null); setCsvTemplateId(""); setCsvEnvIds(new Set()) } }}>
        <SheetContent side="right" style={{ width: '90vw', maxWidth: '90vw' }} className="bg-zinc-950 border-zinc-800 flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b border-zinc-800">
            <SheetTitle className="text-white font-bold text-lg">Bulk Import via CSV</SheetTitle>
            <SheetDescription className="text-zinc-500 text-sm">
              Select a template, download the CSV, fill it in, then upload to create multiple data sets at once.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
            {/* Compact controls row */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Schema Template</Label>
                <Select value={csvTemplateId} onValueChange={async v => { setCsvTemplateId(v); setCsvPreview(null); await getFullTemplate(v) }}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-sm">
                    <SelectValue placeholder="Choose template..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" disabled={!csvTemplateId} onClick={() => downloadCsvTemplate(csvTemplateId)}
                className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 h-9 shrink-0">
                <Download className="size-3.5 mr-1.5" /> Download Template
              </Button>
              <Button variant="outline" size="sm" disabled={!csvTemplateId} onClick={() => fileInputRef.current?.click()}
                className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 h-9 shrink-0">
                <Upload className="size-3.5 mr-1.5" /> Upload CSV
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
            </div>

            {/* Preview */}
            {csvPreview && csvPreview.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-medium">{csvPreview.length} data sets ready to import</p>
                <div className="max-h-48 overflow-auto space-y-1.5 pr-1">
                  {csvPreview.map((ds, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <Layers className="size-3.5 text-zinc-500 shrink-0" />
                      <span className="text-sm font-medium text-zinc-300 flex-1 truncate">{ds.name}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{Object.keys(ds.variables).length} vars</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-zinc-300">Link to Environments <span className="text-zinc-600 font-normal text-xs">(optional)</span></Label>
                  <div className="space-y-2">
                    {environments.map(env => (
                      <div key={env.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all cursor-pointer"
                        onClick={() => setCsvEnvIds(prev => { const s = new Set(prev); s.has(env.id) ? s.delete(env.id) : s.add(env.id); return s })}>
                        <Checkbox checked={csvEnvIds.has(env.id)} className="border-zinc-600" />
                        <Server className="size-3.5 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-300">{env.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {csvPreview && csvPreview.length > 0 && (
            <div className="px-6 py-4 border-t border-zinc-800 flex gap-3">
              <Button onClick={handleBulkImport} className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold h-10">
                Import {csvPreview.length} Data Sets
              </Button>
              <Button variant="ghost" onClick={() => setCsvPreview(null)} className="text-zinc-500 hover:text-white h-10 px-4">
                Clear
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {view === "LIST" ? (
          <>
            <div className="flex items-center gap-4 max-w-2xl mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input placeholder="Search data sets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 text-sm h-10" />
              </div>
              <Select value={filterTemplateId} onValueChange={setFilterTemplateId}>
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 h-10 w-52 text-sm">
                  <SelectValue placeholder="All templates" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All templates</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {filtered.map(ds => (
                <Card key={ds.id} onClick={() => openEdit(ds)}
                  className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden flex flex-col cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0"><Layers className="size-4 text-blue-500" /></div>
                      <span className="truncate">{ds.name}</span>
                    </CardTitle>
                    <p className="text-xs text-zinc-500 pl-10">Schema: <span className="text-zinc-400">{getTemplateName(ds.templateId)}</span></p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ds)}
                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800" title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      {deletingId === ds.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(ds.id)}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold">Confirm</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}
                            className="h-7 px-2 text-zinc-500 hover:text-white text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(ds.id)}
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
                  <Layers className="size-10 text-zinc-700 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-white mb-1">No data sets found</h3>
                  <p className="text-zinc-500 text-sm">{searchTerm ? `No matches for "${searchTerm}"` : "Create a data set to get started."}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setView("LIST"); resetForm() }} className="text-zinc-400 hover:text-white -ml-2">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Button>
              <div className="h-4 w-px bg-zinc-800" />
              <h2 className="text-xl font-bold text-white">{view === "CREATE" ? "New Data Set" : "Edit Data Set"}</h2>
            </div>

            <div className="grid gap-8 bg-zinc-950/40 border border-zinc-800 p-8 rounded-3xl">
              <div className="grid gap-3">
                <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Data Set Name</Label>
                <Input value={dsName} onChange={e => setDsName(e.target.value)} placeholder="e.g. Admin User / Premium Flow"
                  className="bg-zinc-900 border-zinc-800 h-11 text-lg font-bold" />
              </div>

              {view === "CREATE" && (
                <div className="grid gap-3">
                  <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Schema Template</Label>
                  <Select value={selectedTemplateId} onValueChange={onTemplateSelect}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11 text-base font-medium">
                      <SelectValue placeholder="Select a schema template" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {currentTemplate && (
                <>
                  {currentTemplate.attributes.filter(a => a.scope === 'dataset').length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest whitespace-nowrap">Dataset Variables</Label>
                        <div className="h-px w-full bg-zinc-900" />
                      </div>
                      {currentTemplate.attributes.filter(a => a.scope === 'dataset').map(attr => (
                        <div key={attr.key} className="grid grid-cols-12 gap-4 items-center">
                          <Label className="col-span-12 md:col-span-4 flex items-center gap-2 text-sm font-bold text-zinc-400">
                            <span className="font-mono text-xs">{attr.key}</span>
                            {attr.type === "secret" && <Key className="size-3 text-blue-500" />}
                          </Label>
                          <div className="col-span-12 md:col-span-8">
                            <Input type={attr.type === "secret" ? "password" : "text"}
                              placeholder={attr.type === "secret" && view === "EDIT" ? "Leave blank to keep existing" : (attr.description || attr.defaultValue || attr.type)}
                              value={dsVars[attr.key] || ""}
                              onChange={e => setDsVars({ ...dsVars, [attr.key]: e.target.value })}
                              className="bg-zinc-900/50 border-zinc-800 h-10 text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest whitespace-nowrap">Linked Environments</Label>
                      <div className="h-px w-full bg-zinc-900" />
                    </div>
                    <p className="text-xs text-zinc-600">This data set will be available in all selected environments.</p>
                    {environments.length === 0 ? (
                      <p className="text-xs text-zinc-600 italic">No environments yet. Create environments first.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {environments.map(env => (
                          <div key={env.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all cursor-pointer"
                            onClick={() => setLinkedEnvIds(prev => { const s = new Set(prev); s.has(env.id) ? s.delete(env.id) : s.add(env.id); return s })}>
                            <Checkbox checked={linkedEnvIds.has(env.id)} className="border-zinc-600" />
                            <div className="flex items-center gap-2">
                              <Server className="size-3.5 text-zinc-500" />
                              <span className="text-sm font-medium text-zinc-300">{env.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button size="lg" onClick={handleSave} disabled={!dsName || !selectedTemplateId}
                className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-10 shadow-lg shadow-blue-600/10">
                {view === "CREATE" ? "Create Data Set" : "Save Changes"}
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
