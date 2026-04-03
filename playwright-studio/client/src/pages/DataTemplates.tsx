import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { apiClient } from "@/services/api-client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Database, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type Attribute = { key: string; type: string; scope: string; description: string }
type Template = { id: string; name: string; attributes: Attribute[] }

export default function DataTemplates() {
  const { id } = useParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  
  // New Template Form
  const [name, setName] = useState("")
  const [attributes, setAttributes] = useState<(Attribute & { _id: string })[]>([])

  useEffect(() => {
    if (id) fetchTemplates()
  }, [id])

  async function fetchTemplates() {
    try {
      const data = await apiClient.getDataTemplates(id!)
      setTemplates(data)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleCreateTemplate() {
    try {
      const payload = { 
        name, 
        attributes: attributes.map(({ _id, ...rest }) => rest) // Clean internal IDs 
      }
      await apiClient.createDataTemplate(id!, payload)
      setOpen(false)
      setName("")
      setAttributes([])
      fetchTemplates()
    } catch (e) {
      console.error(e)
    }
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

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title="Data Templates" 
        description="Define variable schemas for your testing environments to ensure consistency across data sets."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/10 transition-all px-6">
                <Plus className="size-5 mr-2" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create Data Template</DialogTitle>
                <CardDescription>Define the attributes that will be required for this template.</CardDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Template Name</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. E2E Base Template" 
                    className="bg-zinc-900 border-zinc-800 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-4 flex justify-between items-center border-t border-zinc-800">
                  <Label className="text-xs font-bold uppercase text-zinc-400">Attributes / Fields</Label>
                  <Button variant="outline" size="sm" onClick={addAttribute} className="border-zinc-700 hover:bg-zinc-800 transition-all">
                    <Plus className="size-3.5 mr-1.5" /> Add Field
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                  {attributes.map((attr, idx) => (
                    <div key={attr._id} className="grid grid-cols-12 gap-4 items-start border border-zinc-800 p-4 rounded-xl bg-zinc-900/30 relative group transition-all hover:border-zinc-700">
                      <div className="col-span-12 md:col-span-6 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500">Variable Key</Label>
                          <Input 
                            placeholder="e.g. app_url" 
                            value={attr.key} 
                            onChange={(e) => updateAttribute(idx, { key: e.target.value })}
                            className="bg-zinc-950 border-zinc-800 h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500">Description</Label>
                          <Input 
                            placeholder="Optional hint..." 
                            value={attr.description} 
                            onChange={(e) => updateAttribute(idx, { description: e.target.value })}
                            className="bg-zinc-950 border-zinc-800 h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-5 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500">Data Type</Label>
                          <Select value={attr.type} onValueChange={(val) => updateAttribute(idx, { type: val })}>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              <SelectItem value="text">Text / String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean (Toggle)</SelectItem>
                              <SelectItem value="secret">Secret (Encrypted)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500">Configuration Scope</Label>
                          <Select value={attr.scope} onValueChange={(val) => updateAttribute(idx, { scope: val })}>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              <SelectItem value="environment">Environment Config</SelectItem>
                              <SelectItem value="dataset">Data Set Config</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-1 flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeAttribute(idx)} 
                          className="h-9 w-9 text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {attributes.length === 0 && (
                    <div className="text-center py-12 text-zinc-600 text-xs border border-dashed border-zinc-800 rounded-xl bg-zinc-900/10">
                      No attributes defined yet. Click "Add Field" to start building your schema.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
                <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button>
                <Button 
                  onClick={handleCreateTemplate} 
                  disabled={!name || attributes.some(a => !a.key)}
                  className="bg-blue-600 hover:bg-blue-500 font-bold"
                >
                  Create Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
          {templates.map(t => (
            <Card key={t.id} className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 transition-all group overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-start pb-4 border-b border-zinc-800/50">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-white">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Database className="size-5 text-blue-500" />
                    </div>
                    {t.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">{t.attributes.length} fields defined in schema</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-2.5">
                  {t.attributes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                       <span className="text-sm italic">Empty schema</span>
                    </div>
                  ) : (
                    t.attributes.slice(0, 6).map(attr => (
                      <div key={attr.key} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-blue-400 font-medium">{attr.key}</span>
                          <span className="text-[10px] text-zinc-500 truncate max-w-[180px]">{attr.description || "No description"}</span>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-[9px] uppercase tracking-wider font-bold text-zinc-400">{attr.type}</Badge>
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none text-[9px] uppercase tracking-wider font-bold">{attr.scope}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                  {t.attributes.length > 6 && (
                    <div className="text-zinc-600 pt-3 text-[10px] font-bold uppercase tracking-widest text-center">
                      + {t.attributes.length - 6} MORE ATTRIBUTES
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {templates.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-zinc-800 rounded-2xl p-20 text-center flex flex-col items-center justify-center bg-zinc-900/5">
              <div className="p-4 bg-zinc-900/50 rounded-full mb-6">
                <Database className="size-10 text-zinc-700" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Schemas Defined</h3>
              <p className="text-zinc-500 max-w-sm text-sm">
                Define a data template to standardize the variables you inject into your test environments and data sets.
              </p>
              <Button 
                variant="outline" 
                className="mt-8 border-zinc-700"
                onClick={() => setOpen(true)}
              >
                Create your first template
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
