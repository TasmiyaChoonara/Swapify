import { Link } from 'react-router-dom'
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react'
import { useEffect, useState, useRef } from 'react'
import useRole from '../hooks/useRole'
import api from '../services/api'

function NotificationBell() {
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
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

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
        onClick={() => setOpen(o => !o)}
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

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="swap-icon" aria-hidden="true">swapify</span>
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
      </div>
    </nav>
  )
}
