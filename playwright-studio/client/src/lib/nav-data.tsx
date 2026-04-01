import { FileText, Play, Settings, Command, Database } from "lucide-react"

export const getNavData = (projectId: string) => ({
  user: {
    name: "Developer",
    email: "dev@example.com",
    avatar: "/avatars/shadcn.jpg",
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
          title: "Scripts",
          url: `/app/project/${projectId}/specs/scripts`
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
      ],
    },
    {
      title: "Data Manager",
      url: `/app/project/${projectId}/data`,
      icon: <Database className="size-4" />,
      items: [
        { title: "Templates", url: `/app/project/${projectId}/data/templates` },
        { title: "Environments & Sets", url: `/app/project/${projectId}/data/environments` },
      ]
    },
    {
      title: "Settings",
      url: `/app/project/${projectId}/settings`,
      icon: <Settings className="size-4" />,
      items: [],
    },
  ]
})
