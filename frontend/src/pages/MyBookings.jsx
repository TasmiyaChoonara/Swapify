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
  complete:  { label: 'Completed', color: 'badge-muted'  },
  completed: { label: 'Completed', color: 'badge-muted'  },
  cancelled: { label: 'Cancelled', color: 'badge-yellow' },
}

function StarSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '.5rem' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.5rem',
            color: star <= value ? '#f59e0b' : 'var(--text-muted)',
            padding: '0',
          }}
        >*</button>
      ))}
    </div>
  )
}

function RatingForm({ booking, currentUserId, onSubmitted }) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const isBuyer = booking.buyer_id === currentUserId
  const revieweeId = isBuyer ? booking.seller_id : booking.buyer_id

  async function handleSubmit(e) {
    e.preventDefault()
    if (score === 0) return setError('Please select a star rating.')
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/ratings', {
        transaction_id: booking.transaction_id,
        reviewee_id: revieweeId,
        score,
        comment: comment.trim() || undefined,
      })
      onSubmitted(booking.id)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to submit rating.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '.75rem', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: '.75rem' }}>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
        Leave a rating for {isBuyer ? 'the seller' : 'the buyer'}
      </p>
      <StarSelector value={score} onChange={setScore} />
      <textarea
        placeholder="Optional comment..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        style={{
          width: '100%', padding: '.5rem .6rem', borderRadius: 'var(--radius)',
          border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
          color: 'var(--text)', fontSize: '.875rem', resize: 'vertical',
          boxSizing: 'border-box', marginBottom: '.5rem',
        }}
      />
      {error && <p style={{ fontSize: '.8rem', color: 'rgb(239,68,68)', marginBottom: '.4rem' }}>{error}</p>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </form>
  )
}

export default function MyBookings() {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const [bookings, setBookings] = useState([])
  const [submittedRatings, setSubmittedRatings] = useState(new Set())
  const [existingRatings, setExistingRatings] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSignedIn) return
    api.get('/bookings/mine')
      .then(async res => {
        setBookings(res.data)
        const complete = res.data.filter(b => b.status === 'complete' || b.status === 'completed')
        const checks = await Promise.allSettled(
          complete.map(b =>
            api.get(`/ratings/user/${b.buyer_id === userId ? b.seller_id : b.buyer_id}`)
              .then(r => ({ bookingId: b.id, ratings: r.data.ratings, txId: b.transaction_id }))
          )
        )
        const alreadyRated = new Set()
        checks.forEach(c => {
          if (c.status === 'fulfilled') {
            const { bookingId, ratings, txId } = c.value
            if (ratings.some(r => r.reviewer_id === userId && r.transaction_id === txId)) {
              alreadyRated.add(bookingId)
            }
          }
        })
        setExistingRatings(alreadyRated)
      })
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false))
  }, [isSignedIn, userId])

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
            <h3>No bookings yet</h3>
            <p>When you book or receive a trade slot, it will appear here.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '.5rem' }}>Browse Listings</Link>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {bookings.map(booking => {
              const { date, time } = formatSlotTime(booking.slot_time)
              const isBuyer = booking.buyer_id === userId
              const badge = STATUS_BADGE[booking.status] ?? STATUS_BADGE.booked
              const isComplete = booking.status === 'complete' || booking.status === 'completed'
              const hasRated = submittedRatings.has(booking.id) || existingRatings.has(booking.id)

              return (
                <div key={booking.id} className="detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
                    <div>
                      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {isBuyer ? 'You are the Buyer' : 'You are the Seller'}
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
                    <Link to={`/book/${booking.trade_id}`} className="btn btn-outline btn-sm">View Slot</Link>
                  </div>

                  {isComplete && !hasRated && (
                    <RatingForm
                      booking={booking}
                      currentUserId={userId}
                      onSubmitted={id => setSubmittedRatings(prev => new Set([...prev, id]))}
                    />
                  )}
                  {isComplete && submittedRatings.has(booking.id) && (
                    <p style={{ fontSize: '.8rem', color: 'rgb(34,197,94)', marginTop: '.5rem' }}>Rating submitted</p>
                  )}
                  {isComplete && existingRatings.has(booking.id) && !submittedRatings.has(booking.id) && (
                    <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>You have already rated this transaction</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
