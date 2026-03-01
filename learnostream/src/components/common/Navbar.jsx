import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-dark-900/90 backdrop-blur-md border-b border-dark-600">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-sm font-display">L</span>
          <span className="font-display font-bold text-xl tracking-tight">
            Learno<span className="text-brand-400">Stream</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/" className="text-[var(--text-muted)] hover:text-white transition-colors">Explore</Link>
          <Link to="/?cat=tech" className="text-[var(--text-muted)] hover:text-white transition-colors">Tech</Link>
          <Link to="/?cat=design" className="text-[var(--text-muted)] hover:text-white transition-colors">Design</Link>
          <Link to="/?cat=business" className="text-[var(--text-muted)] hover:text-white transition-colors">Business</Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="btn-ghost text-sm py-1.5 px-3">
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="btn-ghost text-sm py-1.5 px-3">
                Logout
              </button>
              <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 text-sm font-semibold">
                {(user.displayName || user.email)?.[0]?.toUpperCase()}
              </div>
            </>
          ) : (
            <>
              <Link to="/login"  className="btn-ghost text-sm py-1.5 px-4">Log in</Link>
              <Link to="/signup" className="btn-primary text-sm py-1.5 px-4">Sign up</Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden text-[var(--text-muted)] p-1" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-dark-600 bg-dark-800 px-4 py-4 flex flex-col gap-3 text-sm animate-fade-in">
          <Link to="/" onClick={() => setMobileOpen(false)} className="text-[var(--text-muted)]">Explore</Link>
          {user ? (
            <>
              {isAdmin && <Link to="/admin" onClick={() => setMobileOpen(false)} className="text-brand-400">Admin Dashboard</Link>}
              <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="text-left text-[var(--text-muted)]">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login"  onClick={() => setMobileOpen(false)} className="text-[var(--text-muted)]">Log in</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="text-brand-400">Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
