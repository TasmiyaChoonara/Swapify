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

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const STATUS_BADGE = {
  booked:    { label: 'Booked',    color: 'badge-purple' },
  item_held: { label: 'Item Held', color: 'badge-yellow' },
  complete:  { label: 'Complete',  color: 'badge-green'  },
  cancelled: { label: 'Cancelled', color: 'badge-muted'  },
}

function PaymentBreakdown({ tradeId }) {
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tradeId) return
    api.get(`/payments/my/${tradeId}`)
      .then(res => setPayment(res.data))
      .catch(() => setPayment(null))
      .finally(() => setLoading(false))
  }, [tradeId])

  if (loading) return <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Loading payment...</p>
  if (!payment) return null

  const shortfall = parseFloat(payment.cash_shortfall ?? 0)
  const amount    = parseFloat(payment.amount ?? 0)
  const isSettled = shortfall === 0

  return (
    <div style={{ marginTop: '.75rem', padding: '.75rem', background: 'rgba(139,92,246,.06)', borderRadius: '8px', fontSize: '.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Paid online</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>R{amount.toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Cash due at facility</span>
        <span style={{ color: shortfall > 0 ? 'rgb(251,146,60)' : 'var(--text)', fontWeight: 500 }}>
          R{shortfall.toFixed(2)}
        </span>
      </div>
      <span style={{
        display: 'inline-block', padding: '.2rem .6rem', borderRadius: '999px',
        fontSize: '.75rem', fontWeight: 600,
        background: isSettled ? 'rgba(34,197,94,.15)' : 'rgba(251,146,60,.15)',
        color: isSettled ? 'rgb(34,197,94)' : 'rgb(251,146,60)',
      }}>
        {isSettled ? 'Fully settled' : 'Cash pending'}
      </span>
    </div>
  )
}

function RatingForm({ transactionId, revieweeDbId, revieweeLabel }) {
  const [score, setScore]         = useState(0)
  const [hover, setHover]         = useState(0)
  const [comment, setComment]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  if (submitted) {
    return (
      <div style={{ marginTop: '.75rem', padding: '.75rem', background: 'rgba(34,197,94,.08)', borderRadius: '8px', fontSize: '.875rem', color: 'rgb(34,197,94)' }}>
        Rating submitted — thanks for the feedback!
      </div>
    )
  }

  async function handleSubmit() {
    if (!score) { setError('Please select a star rating.'); return }
    if (!transactionId) { setError('No transaction linked yet.'); return }
    setLoading(true)
    setError(null)
    try {
      await api.post('/ratings', {
        transaction_id: transactionId,
        reviewee_id:    revieweeDbId,
        score,
        comment: comment.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to submit rating.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '.75rem', padding: '.9rem', background: 'rgba(139,92,246,.06)', borderRadius: '8px' }}>
      <p style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.6rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Rate {revieweeLabel}
      </p>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '.75rem' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setScore(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.6rem', lineHeight: 1, padding: '0 2px',
              color: s <= (hover || score) ? '#f59e0b' : 'rgba(255,255,255,.2)',
              transition: 'color .1s',
            }}
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
          >&#9733;</button>
        ))}
        {score > 0 && (
          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '4px' }}>
            {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][score]}
          </span>
        )}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        style={{
          width: '100%', padding: '.5rem .75rem',
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: '6px', color: 'var(--text)', fontSize: '.875rem',
          resize: 'vertical', marginBottom: '.6rem', fontFamily: 'inherit',
        }}
      />
      {error && <p style={{ fontSize: '.8rem', color: 'rgb(239,68,68)', marginBottom: '.4rem' }}>{error}</p>}
      <button
        className="btn btn-primary btn-sm"
        onClick={handleSubmit}
        disabled={loading || !score}
      >
        {loading ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  )
}

function BookingRatingForm({ booking, currentUserId }) {
  const revieweeClerkId = currentUserId === booking.buyer_id ? booking.seller_id : booking.buyer_id
  const revieweeLabel   = currentUserId === booking.buyer_id ? 'the seller' : 'the buyer'
  const [revieweeDbId, setRevieweeDbId] = useState(null)

  useEffect(() => {
    if (!revieweeClerkId) return
    api.get(`/users/by-clerk/${revieweeClerkId}`)
      .then(res => setRevieweeDbId(res.data?.id))
      .catch(() => {})
  }, [revieweeClerkId])

  if (!revieweeDbId) return null

  return (
    <RatingForm
      transactionId={booking.transaction_id}
      revieweeDbId={revieweeDbId}
      revieweeLabel={revieweeLabel}
    />
  )
}

export default function MyBookings() {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const [bookings, setBookings]   = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!isSignedIn) return
    Promise.all([
      api.get('/bookings/mine'),
      api.get('/transactions/my-purchases'),
    ])
      .then(([bookingsRes, purchasesRes]) => {
        setBookings(bookingsRes.data)
        setPurchases(purchasesRes.data)
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false))
  }, [isSignedIn])

  if (!isLoaded) return <div className="page"><div className="container"><div className="spinner" /></div></div>
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="page">
      <div className="container">

        {/* My Purchases */}
        <div className="section-header" style={{ marginTop: '2rem' }}>
          <h2>My Purchases</h2>
          {!loading && <span className="result-count">{purchases.length} {purchases.length === 1 ? 'purchase' : 'purchases'}</span>}
        </div>

        {loading && <div className="spinner" />}
        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && purchases.length === 0 && (
          <div className="empty-state" style={{ marginBottom: '2rem' }}>
            <h3>No purchases yet</h3>
            <p>Items you buy will appear here.</p>
          </div>
        )}

        {!loading && !error && purchases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {purchases.map(purchase => (
              <div key={purchase.id} className="detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
                  <div>
                    <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Purchase
                    </p>
                    <h3 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '.1rem' }}>
                      {purchase.listing_title}
                    </h3>
                    <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                      Seller: {purchase.seller_name}
                    </p>
                  </div>
                  <span className="badge badge-green">Purchased</span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.1rem' }}>DATE</p>
                    <p style={{ fontSize: '.9rem', color: 'var(--text)', fontWeight: 500 }}>{formatDate(purchase.created_at)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.1rem' }}>PRICE</p>
                    <p style={{ fontSize: '.9rem', color: 'var(--text)', fontWeight: 500 }}>R{parseFloat(purchase.price).toFixed(2)}</p>
                  </div>
                </div>

                {purchase.status === 'complete' && (
                  <RatingForm
                    transactionId={purchase.id}
                    revieweeDbId={purchase.seller_db_id}
                    revieweeLabel="the seller"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* My Trade Bookings */}
        <div className="section-header" style={{ marginTop: '1rem' }}>
          <h2>My Trade Bookings</h2>
          {!loading && !error && (
            <span className="result-count">
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </span>
          )}
        </div>

        {!loading && !error && bookings.length === 0 && (
          <div className="empty-state">
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
              const isBuyer    = booking.buyer_id === userId
              const badge      = STATUS_BADGE[booking.status] ?? STATUS_BADGE.booked
              const isComplete = booking.status === 'complete'

              return (
                <div key={booking.id} className="detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
                    <div>
                      <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {isBuyer ? 'Buyer' : 'Seller'}
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

                  {isBuyer && <PaymentBreakdown tradeId={booking.trade_id} />}

                  {isComplete && (
                    <BookingRatingForm booking={booking} currentUserId={userId} />
                  )}

                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <Link to={`/book/${booking.trade_id}`} className="btn btn-outline btn-sm">
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
