import { lazy, Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import PageLoader from "./pages/PageLoader"
import { AuthProvider } from "./contexts/AuthContext"

const Login = lazy(() => import("./pages/Login"))
const Projects = lazy(() => import("./pages/Projects"))
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"))
const TestSpecs = lazy(() => import("./pages/TestSpecs"))
const MenuOverview = lazy(() => import("./pages/MenuOverview"))
const NotFound = lazy(() => import("./pages/NotFound"))
const RunLogPage = lazy(() => import("./pages/RunLogPage"))
const ExecutionsRuns = lazy(() => import("./pages/ExecutionsRuns"))
const NewProject = lazy(() => import("./pages/NewProject"))
const DataTemplates = lazy(() => import("./pages/DataTemplates"))
const DataEnvironments = lazy(() => import("./pages/DataEnvironments"))
const DataSets = lazy(() => import("./pages/DataSets"))
const ProjectSettings = lazy(() => import("./pages/ProjectSettings"))
const Schedules = lazy(() => import("./pages/Schedules"))

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="playwright-studio-theme">
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/app/login" replace />} />
                <Route path="/app" element={<Navigate to="/app/projects" replace />} />
                <Route path="/app/login" element={<Login />} />
                <Route path="/app/projects" element={<Projects />} />
                <Route path="/app/projects/new" element={<NewProject />} />

                <Route path="/app/project/:id" element={<DashboardLayout />}>
                  {/* Menu Overviews */}
                  <Route path="test-specs" element={<MenuOverview section="Test Specs" />} />
                  <Route path="executions" element={<MenuOverview section="Executions" />} />
                  <Route path="settings" element={<MenuOverview section="Settings" />} />

                  <Route path="specs" element={<TestSpecs />} />
                  <Route path="specs/*" element={<TestSpecs />} />

                  <Route path="schedules" element={<Schedules />} />
                  <Route path="schedules/*" element={<Schedules />} />

                  <Route path="run/:runId" element={<RunLogPage />} />
                  <Route path="executions/runs" element={<ExecutionsRuns />} />
                  {/* Data Manager */}
                  <Route path="data" element={<MenuOverview section="Data Manager" />} />
                  <Route path="data/templates" element={<DataTemplates />} />
                  <Route path="data/environments" element={<DataEnvironments />} />
                  <Route path="data/datasets" element={<DataSets />} />
                  {/* Settings */}
                  <Route path="settings/run" element={<ProjectSettings />} />
                  {/* Other nested routes go here */}
                </Route>

                {/* 404 catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  )
}

