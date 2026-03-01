import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function AdminRoute() {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="flex h-64 items-center justify-center text-[var(--text-muted)]">Loading…</div>
  if (!user)    return <Navigate to="/login"  replace />
  if (!isAdmin) return <Navigate to="/"       replace />
  return <Outlet />
}
