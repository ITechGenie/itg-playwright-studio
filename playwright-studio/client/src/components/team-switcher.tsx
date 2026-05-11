"use client"
import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDown, Plus, ArrowLeftRight,  SlidersHorizontal } from "lucide-react"

export function TeamSwitcher({
  teams,
  currentProjectId,
  onTeamChange,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
    id?: string
  }[]
  currentProjectId?: string
  onTeamChange?: (team: any) => void
}) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate();

  // Find active team based on currentProjectId
  const activeTeam = React.useMemo(() => {
    return teams.find(t => t.id === currentProjectId) || teams[0];
  }, [teams, currentProjectId]);

  if (!activeTeam) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.id || team.name}
                onClick={() => onTeamChange?.(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-4" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate('/app/admin/settings')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <SlidersHorizontal className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Studio Settings</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate('/app/projects/new')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add Project</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate('/app/projects')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <ArrowLeftRight className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Switch Project</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
