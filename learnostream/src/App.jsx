import { Routes, Route } from 'react-router-dom'
import Layout from './components/common/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VideoPage from './pages/VideoPage'
import LivePage from './pages/LivePage'
import AdminDashboard from './pages/AdminDashboard'
import UploadPage from './pages/admin/UploadPage'
import ScheduleLivePage from './pages/admin/ScheduleLivePage'
import GoLivePage from './pages/admin/GoLivePage'
import EmbedPage from './pages/EmbedPage'
import AdminRoute from './components/auth/AdminRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/embed/:id" element={<EmbedPage />} />
      <Route element={<Layout />}>
        <Route path="/"              element={<HomePage />} />
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/signup"        element={<SignupPage />} />
        <Route path="/video/:id"     element={<VideoPage />} />
        <Route path="/live/:id"      element={<LivePage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin"                element={<AdminDashboard />} />
          <Route path="/admin/upload"         element={<UploadPage />} />
          <Route path="/admin/go-live"        element={<GoLivePage />} />
          <Route path="/admin/schedule-live"  element={<ScheduleLivePage />} />
        </Route>
      </Route>
    </Routes>
  )
}
