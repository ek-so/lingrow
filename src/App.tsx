import { HashRouter, Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"
import Study from "@/pages/Study"

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study/:id" element={<Study />} />
      </Routes>
    </HashRouter>
  )
}

export default App
