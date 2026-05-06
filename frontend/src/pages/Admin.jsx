import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'
import useRole from '../hooks/useRole'

const ROLES = ['student', 'staff', 'admin']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Simple bar chart rendered in SVG
function BarChart({ data, labelKey, valueKey, color = 'var(--accent)' }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No data available.</p>
  const max = Math.max(...data.map(d => Number(d[valueKey])))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', marginTop: '1rem' }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (Number(d[valueKey]) / max) * 100 : 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{d[valueKey]}</span>
            <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', height: `${pct}%`, minHeight: pct > 0 ? '4px' : '0', opacity: 0.85 }} />
            <span style={{ fontSize: '.6rem', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>{d[labelKey]}</span>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: '.8rem', color: 'var(--text)', marginTop: '.2rem' }}>{label}</div>
      {sub && <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>{sub}</div>}
    </div>
  )
}

export default function Admin() {
  const { isSignedIn, isLoaded } = useAuth()
  const { isAdmin, isStaff, loading: roleLoading } = useRole()
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

  // Analytics state
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [exportingCSV, setExportingCSV] = useState(false)

  const canAccess = isAdmin || isStaff

  useEffect(() => {
    if (!isLoaded || roleLoading) return
    if (!isSignedIn || !canAccess) navigate('/', { replace: true })
  }, [isLoaded, roleLoading, isSignedIn, canAccess, navigate])

  useEffect(() => {
    if (!canAccess) return
    const requests = [api.get('/admin/analytics')]
    if (isAdmin) {
      requests.push(api.get('/users'), api.get('/listings'), api.get('/facility-config'))
    }
    Promise.all(requests)
      .then(([aRes, uRes, lRes, cRes]) => {
        setAnalytics(aRes.data)
        if (isAdmin) {
          setUsers(uRes.data)
          setListings(lRes.data)
          setFacilityConfig(cRes.data)
        }
      })
      .catch(err => setError(err.response?.data?.error ?? 'Failed to load data.'))
      .finally(() => { setLoading(false); setAnalyticsLoading(false) })
  }, [canAccess, isAdmin])

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

  async function handleExportCSV() {
    setExportingCSV(true)
    try {
      const res = await api.get('/admin/analytics/export', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `swapify-analytics-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export CSV.')
    } finally {
      setExportingCSV(false)
    }
  }

  if (!isLoaded || roleLoading) {
    return <div className="page"><div className="container"><div className="spinner" /></div></div>
  }

  if (!canAccess) return null

  // Compute summary stats from analytics
  const totalListings = analytics?.listingStats?.reduce((s, r) => s + Number(r.count), 0) ?? '—'
  const activeListings = analytics?.listingStats?.find(r => r.status === 'active')?.count ?? '—'
  const removedListings = analytics?.flagged?.count ?? '—'
  const totalUsers = analytics?.userCount?.count ?? '—'
  const completedTx = analytics?.transactions?.reduce((s, r) => s + Number(r.count), 0) ?? '—'
  const paidPayments = analytics?.paymentStats?.find(r => r.status === 'paid')
  const totalRevenue = paidPayments ? `R${parseFloat(paidPayments.total).toFixed(2)}` : 'R0.00'

  return (
    <div className="page">
      <div className="container">

        <Link to="/" className="back-link">← Back to listings</Link>

        <h1 style={{ color: 'var(--text)', margin: '1.5rem 0 .25rem' }}>Admin Panel</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Manage users, listings, facility configuration, and platform analytics.
        </p>

        {error && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* ── Analytics Dashboard ── */}
        <section className="admin-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 className="admin-section-title" style={{ margin: 0 }}>Analytics Dashboard</h2>
            <button
              className="btn btn-outline"
              onClick={handleExportCSV}
              disabled={exportingCSV || analyticsLoading}
              style={{ fontSize: '.8rem', padding: '.4rem .9rem' }}
            >
              {exportingCSV ? 'Exporting...' : '⬇ Export CSV'}
            </button>
          </div>

          {analyticsLoading ? (
            <div className="spinner" />
          ) : (
            <>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <StatCard label="Total Users" value={totalUsers} />
                <StatCard label="Active Listings" value={activeListings} sub={`${totalListings} total`} />
                <StatCard label="Removed Listings" value={removedListings} sub="moderated" />
                <StatCard label="Completed Trades" value={completedTx} sub="last 30 days" />
                <StatCard label="Online Revenue" value={totalRevenue} sub="paid payments" />
              </div>

              {/* Category chart */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                  <h3 style={{ color: 'var(--text)', fontSize: '.85rem', margin: '0 0 .25rem' }}>Category Popularity</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', margin: '0 0 .5rem' }}>Listings per category</p>
                  <BarChart data={analytics?.categories ?? []} labelKey="category" valueKey="count" color="var(--accent)" />
                </div>

                {/* Transaction trend */}
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                  <h3 style={{ color: 'var(--text)', fontSize: '.85rem', margin: '0 0 .25rem' }}>Completed Transactions</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', margin: '0 0 .5rem' }}>Last 30 days</p>
                  <BarChart
                    data={(analytics?.transactions ?? []).map(r => ({ ...r, date: new Date(r.date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) }))}
                    labelKey="date"
                    valueKey="count"
                    color="rgb(34,197,94)"
                  />
                </div>
              </div>

              {/* Listing status + payment breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                  <h3 style={{ color: 'var(--text)', fontSize: '.85rem', margin: '0 0 .75rem' }}>Listing Status Breakdown</h3>
                  <table className="admin-table">
                    <thead><tr><th>Status</th><th>Count</th></tr></thead>
                    <tbody>
                      {(analytics?.listingStats ?? []).map(r => (
                        <tr key={r.status}>
                          <td><span className={`badge ${r.status === 'active' ? 'badge-green' : r.status === 'removed' ? 'badge-muted' : 'badge-yellow'}`}>{r.status}</span></td>
                          <td className="admin-cell-muted">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                  <h3 style={{ color: 'var(--text)', fontSize: '.85rem', margin: '0 0 .75rem' }}>Payment Summary</h3>
                  <table className="admin-table">
                    <thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead>
                    <tbody>
                      {(analytics?.paymentStats ?? []).map(r => (
                        <tr key={r.status}>
                          <td><span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'failed' ? 'badge-muted' : 'badge-yellow'}`}>{r.status}</span></td>
                          <td className="admin-cell-muted">{r.count}</td>
                          <td className="admin-cell-muted">R{parseFloat(r.total).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(analytics?.paymentStats ?? []).length === 0 && (
                        <tr><td colSpan={3} style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No payments yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        {loadingData ? (
          <div className="spinner" />
        ) : (
          <>
            {/* ── Facility Config (admin only) ── */}
            {isAdmin && (
              <section className="admin-section">
                <h2 className="admin-section-title">Trade Facility Configuration</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--text)', fontSize: '.9rem', marginBottom: '.75rem' }}>Current Schedule</h3>
                    {facilityConfig.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No configuration set yet.</p>
                    ) : (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Day</th><th>Open</th><th>Close</th><th>Capacity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facilityConfig.map(c => (
                              <tr key={c.id} style={{ cursor: 'pointer' }}
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

                  <div>
                    <h3 style={{ color: 'var(--text)', fontSize: '.9rem', marginBottom: '.75rem' }}>Update Day Config</h3>
                    <form onSubmit={handleConfigSave} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                      <div>
                        <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Day of Week</label>
                        <select className="admin-role-select" style={{ width: '100%' }}
                          value={configForm.dayOfWeek}
                          onChange={e => setConfigForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                        >
                          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                        <div>
                          <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Open Time</label>
                          <input type="time" value={configForm.openTime}
                            onChange={e => setConfigForm(f => ({ ...f, openTime: e.target.value }))}
                            style={{ width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Close Time</label>
                          <input type="time" value={configForm.closeTime}
                            onChange={e => setConfigForm(f => ({ ...f, closeTime: e.target.value }))}
                            style={{ width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.3rem' }}>Slot Capacity</label>
                        <input type="number" min="1" value={configForm.slotCapacity}
                          onChange={e => setConfigForm(f => ({ ...f, slotCapacity: Number(e.target.value) }))}
                          style={{ width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'var(--text)', fontSize: '.875rem', boxSizing: 'border-box' }}
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
            )}

            {/* ── Users table (admin only) ── */}
            {isAdmin && (
              <section className="admin-section">
                <h2 className="admin-section-title">Users ({users.length})</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td className="admin-cell-muted">{u.email}</td>
                          <td>
                            <select className="admin-role-select" value={u.role}
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
            )}

            {/* ── Listings table (admin only) ── */}
            {isAdmin && (
              <section className="admin-section">
                <h2 className="admin-section-title">Listings ({listings.length})</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Title</th><th>Category</th><th>Type</th><th>Status</th><th>Price</th><th></th></tr>
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
                            <span className={`badge ${l.status === 'active' ? 'badge-green' : 'badge-muted'}`}>{l.status}</span>
                          </td>
                          <td className="admin-cell-muted">
                            {l.type === 'trade' ? 'Trade' : l.price != null ? `R${parseFloat(l.price).toFixed(2)}` : '—'}
                          </td>
                          <td>
                            <button className="admin-delete-btn"
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
