import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { apiClient } from "@/services/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
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
    <div className="flex flex-col h-full space-y-6 p-6 overflow-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Templates</h1>
          <p className="text-muted-foreground">Define variable schemas for your testing environments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Data Template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Template Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. E2E Base Template" />
              </div>
              <div className="pt-4 flex justify-between items-center">
                <Label>Attributes</Label>
                <Button variant="outline" size="sm" onClick={addAttribute}><Plus className="size-3 mr-1" /> Add Field</Button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2">
                {attributes.map((attr, idx) => (
                  <div key={attr._id} className="grid grid-cols-12 gap-4 items-start border p-4 rounded-md bg-secondary/20 relative">
                    <div className="col-span-12 md:col-span-6 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Variable Key</Label>
                        <Input placeholder="e.g. app_url" value={attr.key} onChange={(e) => updateAttribute(idx, { key: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Description (Optional)</Label>
                        <Input placeholder="What is this used for?" value={attr.description} onChange={(e) => updateAttribute(idx, { description: e.target.value })} />
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-5 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Data Type</Label>
                        <Select value={attr.type} onValueChange={(val) => updateAttribute(idx, { type: val })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="secret">Secret (Encrypted)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Scope</Label>
                        <Select value={attr.scope} onValueChange={(val) => updateAttribute(idx, { scope: val })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="environment">Environment Config</SelectItem>
                            <SelectItem value="dataset">Data Set Config</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeAttribute(idx)} className="mt-6 hover:bg-destructive/20 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {attributes.length === 0 && (
                <div className="text-center text-sm text-muted-foreground p-4 bg-secondary/10 rounded-md">
                  No attributes defined yet.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTemplate} disabled={!name || attributes.some(a => !a.key)}>Save Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {templates.map(t => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row justify-between items-start pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="size-5 text-primary" /> {t.name}
                </CardTitle>
                <CardDescription className="mt-1">{t.attributes.length} attributes defined</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm mt-4">
                {t.attributes.length === 0 ? (
                  <span className="text-muted-foreground">Empty schema</span>
                ) : (
                  t.attributes.slice(0, 5).map(attr => (
                    <div key={attr.key} className="flex justify-between items-center py-1 border-b last:border-0 border-border/50">
                      <span className="font-medium">{attr.key}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline">{attr.type}</Badge>
                        <Badge variant="secondary">{attr.scope}</Badge>
                      </div>
                    </div>
                  ))
                )}
                {t.attributes.length > 5 && (
                  <div className="text-muted-foreground pt-2 text-xs italic">
                    + {t.attributes.length - 5} more attributes
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full border-2 border-dashed rounded-lg p-12 text-center flex flex-col items-center justify-center">
            <Database className="size-8 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Templates</h3>
            <p className="text-muted-foreground max-w-sm mt-1">
              Create a data template to standardize the variables you inject into your test environments.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
