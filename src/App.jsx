import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import PublicPage from './pages/PublicPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <Link to="/" className="brand">
          Kürtök találkozója 2026 - Kispályás labdarúgú torna
        </Link>
        <Link to="/admin" className="admin-link">
          Admin
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  )
}
