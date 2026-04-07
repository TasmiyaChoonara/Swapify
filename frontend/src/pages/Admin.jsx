import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'
import useRole from '../hooks/useRole'

const ROLES = ['student', 'staff', 'admin']

export default function Admin() {
  const { isSignedIn, isLoaded } = useAuth()
  const { isAdmin, loading: roleLoading } = useRole()
  const navigate = useNavigate()

  const [users, setUsers]         = useState([])
  const [listings, setListings]   = useState([])
  const [loadingData, setLoading] = useState(true)
  const [roleUpdating, setRoleUpdating] = useState(null) // userId being updated
  const [deletingId, setDeletingId]     = useState(null)
  const [error, setError] = useState(null)

  // Guard: redirect non-admins once role is known
  useEffect(() => {
    if (!isLoaded || roleLoading) return
    if (!isSignedIn || !isAdmin) navigate('/', { replace: true })
  }, [isLoaded, roleLoading, isSignedIn, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      api.get('/users'),
      api.get('/listings'),
    ])
      .then(([uRes, lRes]) => {
        setUsers(uRes.data)
        setListings(lRes.data)
      })
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load data.'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  async function handleRoleChange(userId, newRole) {
    setRoleUpdating(userId)
    try {
      const res = await api.put(`/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u))
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to update role.')
    } finally {
      setRoleUpdating(null)
    }
  }

  async function handleDeleteListing(listingId) {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    setDeletingId(listingId)
    try {
      await api.delete(`/listings/${listingId}`)
      setListings(prev => prev.filter(l => l.id !== listingId))
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to delete listing.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isLoaded || roleLoading) {
    return <div className="page"><div className="container"><div className="spinner" /></div></div>
  }

  if (!isAdmin) return null // navigating away

  return (
    <div className="page">
      <div className="container">

        <Link to="/" className="back-link">← Back to listings</Link>

        <h1 style={{ color: 'var(--text)', margin: '1.5rem 0 .25rem' }}>Admin Panel</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Manage users and listings across the marketplace.
        </p>

        {error && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {loadingData ? (
          <div className="spinner" />
        ) : (
          <>
            {/* ── Users table ── */}
            <section className="admin-section">
              <h2 className="admin-section-title">Users ({users.length})</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td className="admin-cell-muted">{u.email}</td>
                        <td>
                          <select
                            className="admin-role-select"
                            value={u.role}
                            disabled={roleUpdating === u.id}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="admin-cell-muted">
                          {new Date(u.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Listings table ── */}
            <section className="admin-section">
              <h2 className="admin-section-title">Listings ({listings.length})</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map(l => (
                      <tr key={l.id}>
                        <td>
                          <Link
                            to={`/listings/${l.id}`}
                            style={{ color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            {l.title}
                          </Link>
                        </td>
                        <td className="admin-cell-muted">{l.category ?? '—'}</td>
                        <td className="admin-cell-muted">{l.type}</td>
                        <td>
                          <span className={`badge ${l.status === 'active' ? 'badge-green' : 'badge-muted'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="admin-cell-muted">
                          {l.type === 'trade' ? 'Trade' : l.price != null ? `R${parseFloat(l.price).toFixed(2)}` : '—'}
                        </td>
                        <td>
                          <button
                            className="admin-delete-btn"
                            onClick={() => handleDeleteListing(l.id)}
                            disabled={deletingId === l.id}
                          >
                            {deletingId === l.id ? '…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  )
}
