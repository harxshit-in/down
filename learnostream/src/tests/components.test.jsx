import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock Firebase
vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  functions: {},
  googleProvider: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  serverTimestamp: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}))

// ------------------------------------------------------------------
// VideoCard
// ------------------------------------------------------------------
import VideoCard from '../components/video/VideoCard'

describe('VideoCard', () => {
  it('renders video title', () => {
    render(
      <MemoryRouter>
        <VideoCard video={{ id: 'v1', title: 'Test Video', type: 'vod' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Test Video')).toBeInTheDocument()
  })

  it('shows LIVE badge for live videos', () => {
    render(
      <MemoryRouter>
        <VideoCard video={{ id: 'l1', title: 'Live Now', type: 'live' }} />
      </MemoryRouter>
    )
    expect(screen.getByText(/LIVE/)).toBeInTheDocument()
  })

  it('links to /video/:id for VOD', () => {
    render(
      <MemoryRouter>
        <VideoCard video={{ id: 'v1', title: 'My Video', type: 'vod' }} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/video/v1')
  })

  it('links to /live/:id for live', () => {
    render(
      <MemoryRouter>
        <VideoCard video={{ id: 'l1', title: 'Live', type: 'live' }} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/live/l1')
  })
})

// ------------------------------------------------------------------
// Navbar
// ------------------------------------------------------------------
import Navbar from '../components/common/Navbar'

describe('Navbar', () => {
  it('renders logo', () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>)
    expect(screen.getByText(/LearnoStream/i)).toBeInTheDocument()
  })

  it('shows Login and Sign up when no user', () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>)
    expect(screen.getByText(/Log in/i)).toBeInTheDocument()
    expect(screen.getByText(/Sign up/i)).toBeInTheDocument()
  })
})

// ------------------------------------------------------------------
// YouTubeEmbed
// ------------------------------------------------------------------
import YouTubeEmbed from '../components/video/YouTubeEmbed'

describe('YouTubeEmbed', () => {
  it('renders an iframe', () => {
    render(<YouTubeEmbed videoId="abc123" />)
    expect(screen.getByTitle('YouTube Live Stream')).toBeInTheDocument()
  })

  it('uses provided videoId in src', () => {
    render(<YouTubeEmbed videoId="testId" />)
    const iframe = screen.getByTitle('YouTube Live Stream')
    expect(iframe.src).toContain('testId')
  })
})
