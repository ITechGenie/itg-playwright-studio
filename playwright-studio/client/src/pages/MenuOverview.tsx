import { useParams, useNavigate } from "react-router-dom"
import { getNavData } from "@/lib/nav-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"

export default function MenuOverview({ section }: { section: "Test Specs" | "Executions" | "Data Manager" | "Settings" }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const navData = getNavData(id || "1")
  const currentSection = navData.navMain.find((s: any) => s.title === section)

  if (!currentSection) return null

  const sectionItems: any[] = (currentSection as any).items || []

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <PageHeader 
        title={currentSection.title} 
        description={`Overview and shortcuts for ${currentSection.title.toLowerCase()}.`}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sectionItems.map((item: any) => (
            <Card 
              key={item.title} 
              className="group cursor-pointer border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/60 hover:border-blue-500/50 transition-all flex flex-col shadow-sm hover:shadow-xl shadow-blue-500/5"
              onClick={() => navigate(item.url)}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-3 text-white group-hover:text-blue-400 transition-colors">
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  {item.items && item.items.length > 0 
                    ? `${item.items.length} mapped sub-items`
                    : `Configure and manage ${item.title.toLowerCase()}`}
                </CardDescription>
              </CardHeader>
              {item.items && item.items.length > 0 && (
                <CardContent className="mt-auto pt-0">
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    {item.items.slice(0, 3).map((sub: any) => (
                      <span key={sub.title} className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400 group-hover:text-blue-300 group-hover:border-blue-900/50 transition-all">
                        {sub.title}
                      </span>
                    ))}
                    {item.items.length > 3 && (
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-600">+{item.items.length - 3} MORE</span>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          {sectionItems.length === 0 && (
            <div className="col-span-full border border-dashed border-zinc-800 rounded-2xl p-20 text-center text-zinc-600 flex flex-col items-center justify-center bg-zinc-900/5 h-[300px]">
              <h3 className="text-lg font-bold text-white mb-2">No Items Found</h3>
              <p className="text-sm max-w-sm">There are no sub-menus configured for this section yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
