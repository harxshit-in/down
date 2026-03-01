import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-dark-600 bg-dark-800 py-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="font-display font-bold text-lg mb-2">
            Learno<span className="text-brand-400">Stream</span>
          </div>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Stream knowledge. Learn live. Your platform for video-first education.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-[var(--text-muted)]">Platform</h4>
          <ul className="space-y-2 text-sm text-[var(--text-muted)]">
            <li><Link to="/" className="hover:text-white transition-colors">Explore</Link></li>
            <li><Link to="/login" className="hover:text-white transition-colors">Sign in</Link></li>
            <li><Link to="/signup" className="hover:text-white transition-colors">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-[var(--text-muted)]">Legal</h4>
          <ul className="space-y-2 text-sm text-[var(--text-muted)]">
            <li><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></li>
            <li><span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-dark-600 text-xs text-[var(--text-muted)] text-center">
        © {new Date().getFullYear()} LearnoStream. Built with Firebase + Livepeer.
      </div>
    </footer>
  )
}
