import { Link } from 'react-router-dom'
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react'
import { useEffect, useState, useRef } from 'react'
import useRole from '../hooks/useRole'
import api from '../services/api'

function NotificationBell() {
  const { isSignedIn } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen]                   = useState(false)
  const ref = useRef(null)

  async function fetchNotifications() {
    try {
      const res = await api.get('/notifications')
      setNotifications(Array.isArray(res.data) ? res.data : [])
    } catch {
      // silently fail
    }
  }
useEffect(() => {
  if (!isSignedIn) return
  const timer = setTimeout(fetchNotifications, 1500)
  const interval = setInterval(fetchNotifications, 30000)
  return () => { clearTimeout(timer); clearInterval(interval) }
}, [isSignedIn])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch { }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch { }
  }

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications() }}
        style={{
          background: 'none', border: '1px solid rgba(255,255,255,.2)',
          cursor: 'pointer', color: 'var(--text)', fontSize: '.8rem',
          position: 'relative', padding: '4px 10px', lineHeight: 1,
          borderRadius: 'var(--radius)',
        }}
        aria-label="Notifications"
      >
        Notifications
        {unreadCount > 0 && (
          <span style={{
            marginLeft: '6px',
            background: 'rgb(239,68,68)', color: '#fff',
            borderRadius: '50%', fontSize: '.65rem',
            width: '16px', height: '16px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%',
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 'var(--radius)', width: '300px', maxHeight: '360px',
          overflowY: 'auto', zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          <div style={{ padding: '.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.75rem', color: 'var(--accent)' }}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p style={{ padding: '1rem', fontSize: '.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>No notifications</p>
          )}

          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                padding: '.65rem 1rem',
                borderBottom: '1px solid rgba(255,255,255,.06)',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'rgba(139,92,246,.08)',
              }}
            >
              <p style={{ fontSize: '.82rem', color: 'var(--text)', margin: 0 }}>{n.message}</p>
              <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '.2rem 0 0' }}>
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { isSignedIn } = useAuth()
  const { isAdmin, isStaff } = useRole()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() { setMenuOpen(false) }

  return (
    <>
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link to="/" className="navbar-brand" onClick={closeMenu}>
            <span className="swap-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5h10M13 5l-2-2M13 5l-2 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 13H5M5 13l2-2M5 13l2 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            Swap<span className="brand-accent">ify</span>
          </Link>

          <div className="navbar-links">
            <Link to="/" className="navbar-link">Home</Link>

            {isSignedIn ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="navbar-link">Admin Panel</Link>
                )}
                {(isStaff || isAdmin) && (
                  <Link to="/staff" className="navbar-link">Staff Dashboard</Link>
                )}
                <Link to="/my-bookings" className="navbar-link">My Bookings</Link>
                <Link to="/saved" className="navbar-link">Saved</Link>
                <Link to="/my-sales" className="navbar-link">My Sales</Link>
                <Link to="/listings/new" className="btn btn-primary btn-sm">
                  + Sell Item
                </Link>
                <NotificationBell />
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost btn-sm">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn btn-primary btn-sm">Get Started</button>
                </SignUpButton>
              </>
            )}
          </div>

          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="nav-drawer-overlay" onClick={closeMenu}>
          <div className="nav-drawer" onClick={e => e.stopPropagation()}>
            <button className="nav-drawer-close" onClick={closeMenu} aria-label="Close menu">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <nav className="nav-drawer-items">
              <Link to="/" className="nav-drawer-link" onClick={closeMenu}>Home</Link>

              {isSignedIn ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" className="nav-drawer-link" onClick={closeMenu}>Admin Panel</Link>
                  )}
                  {(isStaff || isAdmin) && (
                    <Link to="/staff" className="nav-drawer-link" onClick={closeMenu}>Staff Dashboard</Link>
                  )}
                  <Link to="/my-bookings" className="nav-drawer-link" onClick={closeMenu}>My Bookings</Link>
                  <Link to="/saved" className="nav-drawer-link" onClick={closeMenu}>Saved</Link>
                  <Link to="/my-sales" className="nav-drawer-link" onClick={closeMenu}>My Sales</Link>
                  <Link to="/listings/new" className="nav-drawer-link" onClick={closeMenu}>+ Sell Item</Link>
                  <div className="nav-drawer-row">
                    <NotificationBell />
                  </div>
                  <div className="nav-drawer-row">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </>
              ) : (
                <div className="nav-drawer-actions">
                  <SignInButton mode="modal">
                    <button className="btn btn-ghost btn-sm nav-drawer-btn" onClick={closeMenu}>Sign In</button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="btn btn-primary btn-sm nav-drawer-btn" onClick={closeMenu}>Get Started</button>
                  </SignUpButton>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
