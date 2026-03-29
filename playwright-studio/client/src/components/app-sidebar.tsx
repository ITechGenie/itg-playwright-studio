"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useParams, useNavigate } from "react-router-dom"
import { getNavData } from "@/lib/nav-data"
import { apiClient } from "@/services/api-client"
import { useAuth } from "@/contexts/AuthContext"
import { Command } from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const params = useParams()
  const navigate = useNavigate()
  const projectId = params.id || ""
  
  const [projectsList, setProjectsList] = React.useState<any[]>([])

  React.useEffect(() => {
    apiClient.getProjects().then(data => {
      setProjectsList(data)
    }).catch(err => console.error(err))
  }, [])

  const [user, setUser] = React.useState<any>(null)

  const { user: authUser, logout } = useAuth();

  const data = getNavData(projectId);
  
  // Transform projects into teams for TeamSwitcher
  const teams = projectsList.map(p => ({
    name: p.name,
    logo: Command,
    plan: "Local Workspace",
    id: p.id // include ID for navigation
  }))

  const handleTeamChange = (team: any) => {
    if (team.id) {
      navigate(`/app/project/${team.id}/specs`)
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher 
          teams={teams.length > 0 ? teams : data.teams} 
          currentProjectId={projectId}
          onTeamChange={handleTeamChange}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={authUser || data.user}
          onLogout={logout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
