import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-64 items-center justify-center text-[var(--text-muted)]">Loading…</div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
