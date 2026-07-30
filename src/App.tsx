import { HashRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/lib/auth-context"
import { CollectionsProvider } from "@/lib/collections-context"
import { LoginPrompt } from "@/components/LoginPrompt"
import Home from "@/pages/Home"
import Study from "@/pages/Study"
import NewList from "@/pages/NewList"
import EditList from "@/pages/EditList"
import ImportWords from "@/pages/ImportWords"
import Profile from "@/pages/Profile"

function App() {
  return (
    <AuthProvider>
      <CollectionsProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/new" element={<NewList />} />
            <Route path="/edit/:id" element={<EditList />} />
            <Route path="/import" element={<ImportWords />} />
            <Route path="/study/:id" element={<Study />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
          <LoginPrompt />
        </HashRouter>
      </CollectionsProvider>
    </AuthProvider>
  )
}

export default App
