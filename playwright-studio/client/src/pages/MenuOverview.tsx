import { useParams, useNavigate } from "react-router-dom"
import { getNavData } from "@/lib/nav-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MenuOverview({ section }: { section: "Test Specs" | "Executions" | "Settings" }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const navData = getNavData(id || "1")
  const currentSection = navData.navMain.find((s: any) => s.title === section)

  if (!currentSection) return null

  const sectionItems: any[] = (currentSection as any).items || []

  return (
    <div className="flex flex-col h-full space-y-6 p-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-md text-primary">
          {currentSection.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentSection.title}</h1>
          <p className="text-muted-foreground">Overview and shortcuts for {currentSection.title.toLowerCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {sectionItems.map((item: any) => (
          <Card 
            key={item.title} 
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all flex flex-col"
            onClick={() => navigate(item.url)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <CardDescription>
                {item.items && item.items.length > 0 
                  ? `${item.items.length} mapped sub-items`
                  : `Go to ${item.title.toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            {item.items && item.items.length > 0 && (
              <CardContent className="mt-auto">
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.items.slice(0, 3).map((sub: any) => (
                    <span key={sub.title} className="bg-secondary px-2 py-1 rounded-md text-secondary-foreground truncate max-w-full">
                      {sub.title}
                    </span>
                  ))}
                  {item.items.length > 3 && (
                    <span className="bg-secondary px-2 py-1 rounded-md text-muted-foreground">+{item.items.length - 3}</span>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {sectionItems.length === 0 && (
          <div className="col-span-full border border-dashed rounded-lg p-12 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
            No sub-menus configured for this section yet.
          </div>
        )}
      </div>
    </div>
  )
}
