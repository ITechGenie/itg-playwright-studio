import { FileText, Play, Settings, Command, Database } from "lucide-react"

export const getNavData = (projectId: string) => ({
  user: {
    name: "Developer",
    email: "dev@example.com",
    avatar: "/app/playwright-studio.png",
  },
  teams: [
    {
      name: projectId, // Dynamic binding to current selected path
      logo: Command as any,
      plan: "Local Workspace",
    }
  ],
  navMain: [
    {
      title: "Test Specs",
      url: `/app/project/${projectId}/test-specs`,
      icon: <FileText className="size-4" />,
      isActive: true,
      items: [
        {
          title: "User Journeys",
          url: `/app/project/${projectId}/specs`
        },
        {
          title: "Schedules",
          url: `/app/project/${projectId}/schedules`
        }
      ],
    },
    {
      title: "Executions",
      url: `/app/project/${projectId}/executions`,
      icon: <Play className="size-4" />,
      items: [
        {
          title: "Runs",
          url: `/app/project/${projectId}/executions/runs`
        },
        {
          title: "Reports",
          url: `/app/project/${projectId}/executions/reports`
        },
      ],
    },
    {
      title: "Data Manager",
      url: `/app/project/${projectId}/data`,
      icon: <Database className="size-4" />,
      items: [
        { title: "Templates", url: `/app/project/${projectId}/data/templates` },
        { title: "Environments", url: `/app/project/${projectId}/data/environments` },
        { title: "Data Sets", url: `/app/project/${projectId}/data/datasets` },
      ]
    },
    {
      title: "Settings",
      url: `/app/project/${projectId}/settings`,
      icon: <Settings className="size-4" />,
      items: [
        { title: "Run Configuration", url: `/app/project/${projectId}/settings/run` },
        { title: "User Management", url: `/app/project/${projectId}/settings/users` },
        { title: "Export / Import", url: `/app/project/${projectId}/settings/data-transfer` },
      ],
    },
  ]
})
