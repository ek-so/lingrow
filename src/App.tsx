import { HashRouter, Routes, Route } from "react-router-dom"
import { CollectionsProvider } from "@/lib/collections-context"
import Home from "@/pages/Home"
import Study from "@/pages/Study"
import NewList from "@/pages/NewList"
import EditList from "@/pages/EditList"
import ImportList from "@/pages/ImportList"

function App() {
  return (
    <CollectionsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewList />} />
          <Route path="/edit/:id" element={<EditList />} />
          <Route path="/import" element={<ImportList />} />
          <Route path="/study/:id" element={<Study />} />
        </Routes>
      </HashRouter>
    </CollectionsProvider>
  )
}

export default App
