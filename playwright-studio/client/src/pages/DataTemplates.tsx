import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Database, Trash2, ArrowLeft, Search, Copy, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type Attribute = { key: string; type: string; scope: string; description: string; defaultValue?: string }
type Template = { id: string; name: string; attributes: Attribute[] }
type ViewState = "LIST" | "CREATE" | "EDIT"

export default function DataTemplates() {
  const { id: projectId } = useParams<{ id: string }>()
  const [templates, setTemplates] = useState<Template[]>([])
  const [view, setView] = useState<ViewState>("LIST")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [name, setName] = useState("")
  const [newAttrIds, setNewAttrIds] = useState<Set<string>>(new Set())
  const [attributes, setAttributes] = useState<(Attribute & { _id: string })[]>([])

  useEffect(() => { if (projectId) fetchTemplates() }, [projectId])

  async function fetchTemplates() {
    try { setLoading(true); setTemplates(await apiClient.getDataTemplates(projectId!)) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleSave() {
    try {
      const payload = { name, attributes: attributes.map(({ _id, ...rest }) => rest) }
      if (view === "EDIT" && currentTemplate) await apiClient.updateDataTemplate(projectId!, currentTemplate.id, payload)
      else await apiClient.createDataTemplate(projectId!, payload)
      resetForm(); fetchTemplates(); setView("LIST")
    } catch (e) { console.error(e) }
  }

  async function handleDelete(templateId: string) {
    try { await apiClient.deleteDataTemplate(projectId!, templateId); setDeletingId(null); fetchTemplates() }
    catch (e) { console.error(e) }
  }

  function resetForm() { setName(""); setAttributes([]); setCurrentTemplate(null); setNewAttrIds(new Set()) }

  function addAttribute() {
    const id = crypto.randomUUID()
    setAttributes(prev => [...prev, { _id: id, key: "", type: "text", scope: "dataset", description: "", defaultValue: "" }])
    if (view === "EDIT") setNewAttrIds(prev => new Set(prev).add(id))
  }

  function updateAttribute(index: number, updates: Partial<Attribute>) {
    setAttributes(prev => { const a = [...prev]; a[index] = { ...a[index], ...updates }; return a })
  }

  function removeAttribute(index: number) {
    const id = attributes[index]._id
    setAttributes(prev => prev.filter((_, i) => i !== index))
    setNewAttrIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const fetchAndSet = async (templateId: string, isDuplicate = false) => {
    try {
      setLoading(true)
      const details = await apiClient.getDataTemplate(projectId!, templateId)
      setCurrentTemplate(details)
      setName(isDuplicate ? `${details.name} (Copy)` : details.name)
      setAttributes(details.attributes.map((a: any) => ({ ...a, _id: crypto.randomUUID() })))
      setNewAttrIds(new Set())
      setView(isDuplicate ? "CREATE" : "EDIT")
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const filtered = templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader title="Data Templates"
        description="Define variable schemas for your testing environments."
        action={view === "LIST" && (
          <Button size="lg" onClick={() => { resetForm(); setView("CREATE") }}
            className="h-11 bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 px-6">
            <Plus className="size-5 mr-2" /> New Template
          </Button>
        )} />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {view === "LIST" ? (
          <>
            <div className="relative max-w-md mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <Input placeholder="Search templates..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 text-sm h-10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {filtered.map(t => (
                <Card key={t.id} onClick={() => fetchAndSet(t.id)}
                  className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden flex flex-col cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0"><Database className="size-4 text-blue-500" /></div>
                      <span className="truncate">{t.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => fetchAndSet(t.id, true)}
                        className="h-8 w-8 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10" title="Duplicate">
                        <Copy className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => fetchAndSet(t.id)}
                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800" title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      {deletingId === t.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold">Confirm</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}
                            className="h-7 px-2 text-zinc-500 hover:text-white text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(t.id)}
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
                  <Database className="size-10 text-zinc-700 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-white mb-1">No templates found</h3>
                  <p className="text-zinc-500 text-sm">{searchTerm ? `No matches for "${searchTerm}"` : "Create a data template to get started."}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setView("LIST"); resetForm() }} className="text-zinc-400 hover:text-white -ml-2">
                <ArrowLeft className="size-4 mr-2" /> Back to list
              </Button>
              <div className="h-4 w-px bg-zinc-800" />
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                {view === "CREATE" ? "New Template" : "Edit Template"}
              </h2>
            </div>

            <div className="grid gap-8">
              <div className="grid gap-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Template Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. E2E Base Template"
                  className="bg-zinc-950 border-zinc-800 h-11 text-lg font-semibold max-w-lg" />
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Schema Fields</Label>
                    <p className="text-xs text-zinc-600">Variables and types that make up this data structure.</p>
                  </div>
                  <Button onClick={addAttribute} variant="outline" size="sm" className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800">
                    <Plus className="size-3.5 mr-1.5" /> Add Field
                  </Button>
                </div>

                <div className="space-y-4">
                  {attributes.map((attr, idx) => {
                    const isNew = newAttrIds.has(attr._id)
                    return (
                      <div key={attr._id} className="grid grid-cols-12 gap-3 items-start border border-zinc-800 p-5 rounded-2xl bg-zinc-950/50 hover:bg-zinc-950 hover:border-zinc-700 transition-all">
                        <div className="col-span-12 md:col-span-3 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-600">Variable Key</Label>
                          <Input placeholder="e.g. login_url" value={attr.key} onChange={e => updateAttribute(idx, { key: e.target.value })}
                            className="bg-zinc-900 border-zinc-800 h-9 font-mono text-sm" />
                        </div>
                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-600">Type</Label>
                          <Select value={attr.type} onValueChange={val => updateAttribute(idx, { type: val })}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="secret">Secret</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-600">Scope</Label>
                          <Select value={attr.scope} onValueChange={val => updateAttribute(idx, { scope: val })}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              <SelectItem value="environment">Env</SelectItem>
                              <SelectItem value="dataset">Data Set</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-12 md:col-span-3 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-600">Description</Label>
                          <Input placeholder="What is this for?" value={attr.description} onChange={e => updateAttribute(idx, { description: e.target.value })}
                            className="bg-zinc-900 border-zinc-800 h-9 text-sm" />
                        </div>
                        <div className="col-span-12 md:col-span-1 pt-6 flex justify-end">
                          <Button variant="ghost" size="icon" onClick={() => removeAttribute(idx)}
                            className="h-9 w-9 text-zinc-600 hover:text-red-500 hover:bg-red-500/10">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {(view === "CREATE" || isNew) && attr.type !== "secret" && (
                          <div className="col-span-12 space-y-1.5 pt-1">
                            <Label className="text-[10px] font-bold uppercase text-zinc-600 flex items-center gap-2">
                              Default Value
                              <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-500 px-1.5 py-0 font-normal">
                                used when env/dataset doesn't set this key
                              </Badge>
                            </Label>
                            <Input placeholder="Leave blank for no default" value={attr.defaultValue || ""}
                              onChange={e => updateAttribute(idx, { defaultValue: e.target.value })}
                              className="bg-zinc-900/50 border-zinc-800 h-9 text-sm max-w-sm" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {attributes.length === 0 && (
                    <div onClick={addAttribute} className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/5 cursor-pointer hover:bg-zinc-900/10 transition-all">
                      <Plus className="size-8 text-zinc-800 mx-auto mb-3" />
                      <p className="text-sm font-medium text-zinc-600">Click to add your first schema field.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-zinc-800">
                <Button size="lg" onClick={handleSave} disabled={!name || attributes.some(a => !a.key)}
                  className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-10 shadow-lg shadow-blue-600/10">
                  {view === "CREATE" ? "Create Template" : "Save Changes"}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => { setView("LIST"); resetForm() }}
                  className="h-11 text-zinc-500 hover:text-white px-8">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
