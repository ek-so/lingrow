import { createHashRouter, Outlet, RouterProvider } from "react-router-dom"
import { AuthProvider } from "@/lib/auth-context"
import { CollectionsProvider } from "@/lib/collections-context"
import { LoginPrompt } from "@/components/LoginPrompt"
import Home from "@/pages/Home"
import Study from "@/pages/Study"
import NewList from "@/pages/NewList"
import EditList from "@/pages/EditList"
import ImportWords from "@/pages/ImportWords"
import Profile from "@/pages/Profile"

function AppLayout() {
  return (
    <>
      <Outlet />
      <LoginPrompt />
    </>
  )
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/folder/:folderId", element: <Home /> },
      { path: "/new", element: <NewList /> },
      { path: "/edit/:id", element: <EditList /> },
      { path: "/import", element: <ImportWords /> },
      { path: "/study/:id", element: <Study /> },
      { path: "/profile", element: <Profile /> },
    ],
  },
])

function App() {
  return (
    <AuthProvider>
      <CollectionsProvider>
        <RouterProvider router={router} />
      </CollectionsProvider>
    </AuthProvider>
  )
}

export default App
