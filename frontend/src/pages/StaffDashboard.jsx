import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'
import useRole from '../hooks/useRole'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

const STATUS_COLORS = {
  booked:    'badge-purple',
  item_held: 'badge-yellow',
  complete:  'badge-green',
  cancelled: 'badge-muted',
}

export default function StaffDashboard() {
  const { isSignedIn, isLoaded } = useAuth()
  const { isStaff, isAdmin, loading: roleLoading } = useRole()
  const [bookings, setBookings]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [actionError, setActionError] = useState({})

  async function fetchBookings() {
    try {
      const res = await api.get('/bookings/staff/today')
      setBookings(res.data)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSignedIn || roleLoading) return
    fetchBookings()
  }, [isSignedIn, roleLoading])

  async function handleAction(bookingId, endpoint, label) {
    setActionError(prev => ({ ...prev, [bookingId]: null }))
    try {
      await api.patch(`/bookings/${bookingId}/${endpoint}`)
      await fetchBookings()
    } catch (err) {
      setActionError(prev => ({
        ...prev,
        [bookingId]: err.response?.data?.error ?? `Failed to ${label}.`,
      }))
    }
  }

  if (!isLoaded || roleLoading) return <div className="page"><div className="container"><div className="spinner" /></div></div>
  if (!isSignedIn) return <Navigate to="/" replace />
  if (!isStaff && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="page">
      <div className="container">
        <div className="section-header" style={{ marginTop: '2rem' }}>
          <h2>Staff Dashboard — Today's Bookings</h2>
          {!loading && !error && (
            <span className="result-count">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} today</span>
          )}
        </div>

        {loading && <div className="spinner" />}
        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && bookings.length === 0 && (
          <div className="empty-state">
            <h3>No bookings today</h3>
            <p>When students book trade slots they will appear here.</p>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)', textAlign: 'left' }}>
                  {['Time', 'Item', 'Buyer', 'Seller', 'Online Paid', 'Cash Due', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '.6rem .75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const shortfall = parseFloat(b.cash_shortfall ?? 0)
                  const onlineAmt = parseFloat(b.online_amount ?? 0)
                  const err = actionError[b.id]
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <td style={{ padding: '.65rem .75rem', whiteSpace: 'nowrap', color: 'var(--text)' }}>{formatTime(b.slot_time)}</td>
                      <td style={{ padding: '.65rem .75rem', color: 'var(--text)' }}>{b.listing_title ?? '—'}</td>
                      <td style={{ padding: '.65rem .75rem', color: 'var(--text-muted)', fontSize: '.8rem' }}>{b.buyer_name ?? b.buyer_id?.slice(0, 14)}</td>
                      <td style={{ padding: '.65rem .75rem', color: 'var(--text-muted)', fontSize: '.8rem' }}>{b.seller_name ?? b.seller_id?.slice(0, 14)}</td>
                      <td style={{ padding: '.65rem .75rem', color: 'var(--text)' }}>R{onlineAmt.toFixed(2)}</td>
                      <td style={{ padding: '.65rem .75rem' }}>
                        {shortfall > 0
                          ? <span style={{ color: b.cash_confirmed ? 'rgb(34,197,94)' : 'rgb(234,179,8)', fontWeight: 600 }}>R{shortfall.toFixed(2)}{b.cash_confirmed ? ' ✓' : ''}</span>
                          : <span style={{ color: 'rgb(34,197,94)' }}>—</span>}
                      </td>
                      <td style={{ padding: '.65rem .75rem' }}>
                        <span className={`badge ${STATUS_COLORS[b.status] ?? 'badge-muted'}`} style={{ textTransform: 'capitalize' }}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '.65rem .75rem' }}>
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                          {b.status === 'booked' && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleAction(b.id, 'receive', 'mark received')}>
                              Mark Received
                            </button>
                          )}
                          {shortfall > 0 && !b.cash_confirmed && b.status !== 'complete' && (
                            <button className="btn btn-outline btn-sm" onClick={() => handleAction(b.id, 'confirm-cash', 'confirm cash')}>
                              Confirm Cash
                            </button>
                          )}
                          {b.status === 'item_held' && (shortfall === 0 || b.cash_confirmed) && (
                            <button className="btn btn-primary btn-sm" style={{ background: 'rgb(34,197,94)', borderColor: 'rgb(34,197,94)' }} onClick={() => handleAction(b.id, 'release', 'release item')}>
                              Release Item
                            </button>
                          )}
                          {b.status === 'item_held' && shortfall > 0 && !b.cash_confirmed && (
                            <button className="btn btn-outline btn-sm" disabled title="Confirm cash first">Release Item</button>
                          )}
                        </div>
                        {err && <p style={{ fontSize: '.75rem', color: 'rgb(239,68,68)', marginTop: '.3rem' }}>{err}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
