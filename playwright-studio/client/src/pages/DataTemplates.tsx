import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Database, Trash2, ArrowLeft, Search, Copy, Eye, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type Attribute = { key: string; type: string; scope: string; description: string }
type Template = { id: string; name: string; attributes: Attribute[] }

type ViewState = "LIST" | "CREATE" | "EDIT" | "DETAILS"

export default function DataTemplates() {
  const { id: projectId } = useParams<{ id: string }>()
  const [templates, setTemplates] = useState<Template[]>([])
  const [view, setView] = useState<ViewState>("LIST")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Current Template (for Create/Edit/Details)
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  
  // Form State
  const [name, setName] = useState("")
  const [attributes, setAttributes] = useState<(Attribute & { _id: string })[]>([])

  useEffect(() => {
    if (projectId) fetchTemplates()
  }, [projectId])

  async function fetchTemplates() {
    try {
      setLoading(true)
      const data = await apiClient.getDataTemplates(projectId!)
      setTemplates(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveTemplate() {
    try {
      const payload = { 
        name, 
        attributes: attributes.map(({ _id, ...rest }) => rest)
      }
      if (view === "EDIT" && currentTemplate) {
        await apiClient.updateDataTemplate(projectId!, currentTemplate.id, payload)
      } else {
        await apiClient.createDataTemplate(projectId!, payload)
      }
      resetForm()
      fetchTemplates()
      setView("LIST")
    } catch (e) {
      console.error(e)
    }
  }

  function resetForm() {
    setName(""); setAttributes([]); setCurrentTemplate(null)
  }

  function addAttribute() {
    setAttributes([...attributes, { _id: crypto.randomUUID(), key: "", type: "text", scope: "dataset", description: "" }])
  }

  function updateAttribute(index: number, updates: Partial<Attribute>) {
    const newAttrs = [...attributes]
    newAttrs[index] = { ...newAttrs[index], ...updates }
    setAttributes(newAttrs)
  }

  function removeAttribute(index: number) {
    setAttributes(attributes.filter((_, i) => i !== index))
  }

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDuplicate = (template: Template) => {
    setName(`${template.name} (Copy)`)
    // Note: In list view, attributes are currently empty due to backend optimization. 
    // We should fetch full details if we want a complete duplicate, OR just the UI-only part.
    // Let's fetch details first to be sure.
    fetchAndSet(template.id, "CREATE", true)
  }

  const fetchAndSet = async (templateId: string, nextView: ViewState, isDuplicate = false) => {
    try {
      setLoading(true)
      const details = await apiClient.getDataTemplate(projectId!, templateId)
      setCurrentTemplate(details)
      if (nextView === "CREATE" || nextView === "EDIT") {
        setName(isDuplicate ? `${details.name} (Copy)` : details.name)
        setAttributes(details.attributes.map((a: any) => ({ ...a, _id: crypto.randomUUID() })))
      }
      setView(nextView)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title="Data Templates" 
        description="Define variable schemas for your testing environments to ensure consistency across data sets."
        action={view === "LIST" && (
          <Button 
            size="lg" 
            onClick={() => { resetForm(); setView("CREATE"); }}
            className="h-11 bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 transition-all px-6"
          >
            <Plus className="size-5 mr-2" /> New Template
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
                  placeholder="Search templates..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-blue-500 text-sm h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              {filteredTemplates.map(t => (
                <Card key={t.id} className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden flex flex-col">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-white">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Database className="size-5 text-blue-500" />
                      </div>
                      <span className="truncate">{t.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500 font-medium">Click to view/edit details</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end gap-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-zinc-900 text-[10px] text-zinc-400 border-zinc-800 px-2 py-0.5 font-bold">
                        {t.attributes.length || "0"} FIELDS
                      </Badge>
                      <div className="flex gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDuplicate(t)}
                          className="h-8 w-8 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10"
                          title="Duplicate template structure"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => fetchAndSet(t.id, "EDIT")}
                          className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800"
                          title="Edit Template"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => fetchAndSet(t.id, "DETAILS")}
                          className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800"
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredTemplates.length === 0 && !loading && (
                <div className="col-span-full border border-dashed border-zinc-800 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-zinc-900/10">
                  <Database className="size-10 text-zinc-700 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-white mb-1">No templates found</h3>
                  <p className="text-zinc-500 text-sm max-w-xs">{searchTerm ? `No matches for "${searchTerm}"` : "Create a data template to get started."}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setView("LIST"); resetForm(); }} className="text-zinc-400 hover:text-white -ml-2">
                <ArrowLeft className="size-4 mr-2" /> Back to list
              </Button>
              <div className="h-4 w-px bg-zinc-800" />
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                {view === "CREATE" ? "New Template" : view === "EDIT" ? "Edit Template" : "Template Details"}
              </h2>
            </div>

            <div className="grid gap-8">
              <div className="grid gap-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Template Name</Label>
                {view === "DETAILS" ? (
                  <div className="text-2xl font-bold text-white flex items-center gap-3">
                     <Database className="size-6 text-blue-500" />
                     {currentTemplate?.name}
                  </div>
                ) : (
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. E2E Base Template" 
                    className="bg-zinc-950 border-zinc-800 h-11 text-lg font-semibold focus:ring-blue-500 max-w-lg"
                  />
                )}
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                   <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase text-zinc-500">Schema Definition</Label>
                      <p className="text-xs text-zinc-600">The variables and types that make up this data structure.</p>
                   </div>
                   {view !== "DETAILS" && (
                     <Button onClick={addAttribute} variant="outline" size="sm" className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800">
                        <Plus className="size-3.5 mr-1.5" /> Add Field
                     </Button>
                   )}
                </div>

                <div className="grid gap-4">
                  {view === "DETAILS" ? (
                    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-zinc-900 border-b border-zinc-800">
                            <th className="px-6 py-4 font-bold text-zinc-400 uppercase text-[10px] tracking-wider w-1/3">Variable Key</th>
                            <th className="px-6 py-4 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Type</th>
                            <th className="px-6 py-4 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Scope</th>
                            <th className="px-6 py-4 font-bold text-zinc-400 uppercase text-[10px] tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {currentTemplate?.attributes.map(attr => (
                            <tr key={attr.key} className="hover:bg-zinc-900/30 transition-colors">
                              <td className="px-6 py-4 font-mono font-medium text-blue-400">{attr.key}</td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-[10px] text-zinc-500 uppercase">{attr.type}</Badge>
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none text-[10px] uppercase">{attr.scope}</Badge>
                              </td>
                              <td className="px-6 py-4 text-zinc-500 text-xs italic">{attr.description || "—"}</td>
                            </tr>
                          ))}
                          {currentTemplate?.attributes.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-zinc-600 text-xs bg-zinc-900/10">No fields defined.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {attributes.map((attr, idx) => (
                        <div key={attr._id} className="grid grid-cols-12 gap-4 items-start border border-zinc-800 p-6 rounded-2xl bg-zinc-950/50 group transition-all hover:bg-zinc-950 hover:border-zinc-700 shadow-sm">
                          <div className="col-span-12 md:col-span-4 space-y-2">
                             <Label className="text-[10px] font-bold uppercase text-zinc-600">Variable Key</Label>
                             <Input 
                                placeholder="e.g. login_url" 
                                value={attr.key} 
                                onChange={(e) => updateAttribute(idx, { key: e.target.value })}
                                className="bg-zinc-900 border-zinc-800 h-10 font-mono text-sm"
                             />
                          </div>
                          <div className="col-span-12 md:col-span-2 space-y-2">
                             <Label className="text-[10px] font-bold uppercase text-zinc-600">Type</Label>
                             <Select value={attr.type} onValueChange={(val) => updateAttribute(idx, { type: val })}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                   <SelectItem value="text">Text</SelectItem>
                                   <SelectItem value="number">Number</SelectItem>
                                   <SelectItem value="boolean">Boolean</SelectItem>
                                   <SelectItem value="secret">Secret</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="col-span-12 md:col-span-2 space-y-2">
                             <Label className="text-[10px] font-bold uppercase text-zinc-600">Scope</Label>
                             <Select value={attr.scope} onValueChange={(val) => updateAttribute(idx, { scope: val })}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                   <SelectItem value="environment">Env</SelectItem>
                                   <SelectItem value="dataset">Data Set</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="col-span-12 md:col-span-3 space-y-2">
                             <Label className="text-[10px] font-bold uppercase text-zinc-600">Description</Label>
                             <Input 
                                placeholder="What is this for?" 
                                value={attr.description} 
                                onChange={(e) => updateAttribute(idx, { description: e.target.value })}
                                className="bg-zinc-900 border-zinc-800 h-10 text-sm"
                             />
                          </div>
                          <div className="col-span-12 md:col-span-1 pt-6 flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeAttribute(idx)} 
                              className="h-10 w-10 text-zinc-600 hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {attributes.length === 0 && (
                        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/5 transition-all hover:bg-zinc-900/10 cursor-pointer" onClick={addAttribute}>
                          <Plus className="size-8 text-zinc-800 mx-auto mb-4" />
                          <p className="text-sm font-medium text-zinc-600">Double click to add your first schema field.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {view !== "DETAILS" && (
                <div className="flex gap-4 pt-4 border-t border-zinc-800">
                   <Button 
                    size="lg" 
                    onClick={handleSaveTemplate}
                    disabled={!name || attributes.some(a => !a.key)}
                    className="h-11 bg-blue-600 hover:bg-blue-500 font-bold px-10 shadow-lg shadow-blue-600/10"
                   >
                     {view === "CREATE" ? "Create Template" : "Save Changes"}
                   </Button>
                   <Button variant="ghost" size="lg" onClick={() => setView("LIST")} className="h-11 text-zinc-500 hover:text-white px-8">Cancel</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
