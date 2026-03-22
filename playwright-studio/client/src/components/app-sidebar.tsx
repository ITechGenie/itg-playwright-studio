"use client"

import * as React from "react"
import { FileText, Play, Settings, Command, Box } from "lucide-react"

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
import allFileItems from "@/data.json"

const specFolders = allFileItems
  .filter((item: any) => item.type === "folder" && item.name)
  .map((folder: any) => ({
    title: folder.name,
    url: `/app/project/1/specs/${folder.name}`,
  }));

const data = {
  user: {
    name: "Developer",
    email: "dev@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc E2E",
      logo: Command,
      plan: "Enterprise",
    },
    {
      name: "Evil Corp Scripts",
      logo: Box,
      plan: "Internal",
    }
  ],
  navMain: [
    {
      title: "Test Specs",
      url: "#",
      icon: <FileText className="size-4" />,
      isActive: true,
      items: [
        {
          title: "View all specs",
          url: "/app/project/1/specs",
          items: specFolders
        },
        {
          title: "Scripts",
          url: "/app/project/1/specs/scripts"
        },
        {
          title: "Learn",
          url: "/app/project/1/learn"
        }
      ],
    },
    {
      title: "Executions",
      url: "/app/project/1/executions",
      icon: <Play className="size-4" />,
      items: [
        {
          title: "Data manager",
          url: "#",
          items: [
            { title: "Data templates", url: "/app/project/1/executions/data-templates" },
            { title: "Environments", url: "/app/project/1/executions/environments" }
          ]
        }
      ],
    },
    {
      title: "Settings",
      url: "/app/project/1/settings",
      icon: <Settings className="size-4" />,
      items: [],
    },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
