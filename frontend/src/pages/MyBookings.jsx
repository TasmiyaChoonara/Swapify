import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import api from '../services/api'

function formatSlotTime(isoString) {
  const date = new Date(isoString)
  return {
    date: date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
  }
}

const STATUS_BADGE = {
  booked:    { label: 'Booked',    color: 'badge-purple' },
  confirmed: { label: 'Confirmed', color: 'badge-green'  },
  completed: { label: 'Completed', color: 'badge-muted'  },
  cancelled: { label: 'Cancelled', color: 'badge-yellow' },
}

export default function MyBookings() {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!isSignedIn) return
    api.get('/bookings/mine')
      .then(res => setBookings(res.data))
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false))
  }, [isSignedIn])

  if (!isLoaded) return <div className="page"><div className="container"><div className="spinner" /></div></div>
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="page">
      <div className="container">

        <div className="section-header" style={{ marginTop: '2rem' }}>
          <h2>My Trade Bookings</h2>
          {!loading && !error && (
            <span className="result-count">
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </span>
          )}
        </div>

        {loading && <div className="spinner" />}

        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && bookings.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No bookings yet</h3>
            <p>When you book or receive a trade slot, it will appear here.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '.5rem' }}>
              Browse Listings
            </Link>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {bookings.map(booking => {
              const { date, time } = formatSlotTime(booking.slot_time)
              const isBuyer = booking.buyer_id === userId
              const badge = STATUS_BADGE[booking.status] ?? STATUS_BADGE.booked

              return (
                <div key={booking.id} className="detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
                    <div>
                      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {isBuyer ? '🛒 You are the Buyer' : '🏷️ You are the Seller'}
                      </p>
                      <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '.1rem' }}>
                        {booking.listing_title ?? 'Trade Listing'}
                      </h3>
                    </div>
                    <span className={`badge ${badge.color}`}>{badge.label}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.1rem' }}>DATE</p>
                      <p style={{ fontSize: '.9rem', color: 'var(--text)', fontWeight: 500 }}>{date}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.1rem' }}>TIME</p>
                      <p style={{ fontSize: '.9rem', color: 'var(--text)', fontWeight: 500 }}>{time}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <Link
                      to={`/book/${booking.trade_id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Slot
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}