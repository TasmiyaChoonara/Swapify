import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'
import useRole from '../hooks/useRole'

const ROLES = ['student', 'staff', 'admin']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Admin() {
  const { isSignedIn, isLoaded } = useAuth()
  const { isAdmin, loading: roleLoading } = useRole()
  const navigate = useNavigate()

  const [users, setUsers]         = useState([])
  const [listings, setListings]   = useState([])
  const [loadingData, setLoading] = useState(true)
  const [roleUpdating, setRoleUpdating] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [error, setError] = useState(null)

  // Facility config state
  const [facilityConfig, setFacilityConfig] = useState([])
  const [configForm, setConfigForm] = useState({
    dayOfWeek: 1,
    openTime: '08:00',
    closeTime: '17:00',
    slotCapacity: 10,
  })
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(null)
  const [configError, setConfigError] = useState(null)

  useEffect(() => {
    if (!isLoaded || roleLoading) return
    if (!isSignedIn || !isAdmin) navigate('/', { replace: true })
  }, [isLoaded, roleLoading, isSignedIn, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      api.get('/users'),
      api.get('/listings'),
      api.get('/facility-config'),
    ])
      .then(([uRes, lRes, cRes]) => {
        setUsers(uRes.data)
        setListings(lRes.data)
        setFacilityConfig(cRes.data)
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

  async function handleConfigSave(e) {
    e.preventDefault()
    setConfigSaving(true)
    setConfigSuccess(null)
    setConfigError(null)
    try {
      const res = await api.put('/facility-config', configForm)
      setFacilityConfig(prev => {
        const exists = prev.find(c => c.day_of_week === res.data.day_of_week)
        if (exists) return prev.map(c => c.day_of_week === res.data.day_of_week ? res.data : c)
        return [...prev, res.data].sort((a, b) => a.day_of_week - b.day_of_week)
      })
      setConfigSuccess(`${DAYS[res.data.day_of_week]} updated successfully.`)
    } catch (err) {
      setConfigError(err.response?.data?.error ?? 'Failed to save config.')
    } finally {
      setConfigSaving(false)
    }
  }

  if (!isLoaded || roleLoading) {
    return <div className="page"><div className="container"><div className="spinner" /></div></div>
  }

  if (!isAdmin) return null

  return (
    <div className="page">
      <div className="container">

        <Link to="/" className="back-link">← Back to listings</Link>

        <h1 style={{ color: 'var(--text)', margin: '1.5rem 0 .25rem' }}>Admin Panel</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Manage users, listings, and trade facility configuration.
        </p>

        {error && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {loadingData ? (
          <div className="spinner" />
        ) : (
          <>
            {/* ── Facility Config ── */}
            <section className="admin-section">
              <h2 className="admin-section-title">Trade Facility Configuration</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                {/* Current config */}
                <div>
                  <h3 style={{ color: 'var(--text)', fontSize: '.9rem', marginBottom: '.75rem' }}>Current Schedule</h3>
                  {facilityConfig.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No configuration set yet.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Open</th>
                            <th>Close</th>
                            <th>Capacity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facilityConfig.map(c => (
                            <tr key={c.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setConfigForm({
                                dayOfWeek: c.day_of_week,
                                openTime: c.open_time.slice(0, 5),
                                closeTime: c.close_time.slice(0, 5),
                                slotCapacity: c.slot_capacity,
                              })}
                            >
                              <td>{DAYS[c.day_of_week]}</td>
                              <td className="admin-cell-muted">{c.open_time.slice(0, 5)}</td>
                              <td className="admin-cell-muted">{c.close_time.slice(0, 5)}</td>
                              <td className="admin-cell-muted">{c.slot_capacity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Edit form */}
                <div>
                  <h3 style={{ color: 'var(--text)', fontSize: '.9rem', marginBottom: '.75rem' }}>Update Day Config</h3>
                  <form onSubmit={handleConfigSave} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>

                    <div>
                      <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Day of Week</label>
                      <select
                        className="admin-role-select"
                        style={{ width: '100%' }}
                        value={configForm.dayOfWeek}
                        onChange={e => setConfigForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                      >
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                      <div>
                        <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Open Time</label>
                        <input
                          type="time"
                          value={configForm.openTime}
                          onChange={e => setConfigForm(f => ({ ...f, openTime: e.target.value }))}
                          style={{
                            width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)',
                            border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
                            color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Close Time</label>
                        <input
                          type="time"
                          value={configForm.closeTime}
                          onChange={e => setConfigForm(f => ({ ...f, closeTime: e.target.value }))}
                          style={{
                            width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)',
                            border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
                            color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Slot Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={configForm.slotCapacity}
                        onChange={e => setConfigForm(f => ({ ...f, slotCapacity: Number(e.target.value) }))}
                        style={{
                          width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)',
                          border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
                          color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {configError && <p style={{ fontSize: '.8rem', color: 'rgb(239,68,68)' }}>{configError}</p>}
                    {configSuccess && <p style={{ fontSize: '.8rem', color: 'rgb(34,197,94)' }}>{configSuccess}</p>}

                    <button type="submit" className="btn btn-primary" disabled={configSaving}>
                      {configSaving ? 'Saving...' : 'Save Config'}
                    </button>
                  </form>
                </div>
              </div>
            </section>

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
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
                          <Link to={`/listings/${l.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
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
