import { useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function PaymentSuccess() {
  const [params] = useSearchParams()
  const listingId = params.get('listing')
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    if (!listingId || !backendUrl) return
    fetch(`${backendUrl}/api/payfast/confirm-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    }).catch(() => {})
  }, [listingId, backendUrl])

  return (
    <div className="page">
      <div className="container">
        <div style={{
          maxWidth: '480px',
          margin: '4rem auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            background: 'rgba(34,197,94,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            fontSize: '1.75rem',
            color: 'rgb(34,197,94)',
          }}>
            &#10003;
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)' }}>
            Payment successful
          </h1>
          <p style={{ fontSize: '.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your payment has been received. The item has been reserved for you.
            Head to My Bookings to arrange collection at the trade facility.
          </p>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '.5rem', flexWrap: 'wrap' }}>
            {listingId && (
              <Link to={`/listings/${listingId}`} className="btn btn-outline btn-lg">
                View Listing
              </Link>
            )}
            <Link to="/my-bookings" className="btn btn-primary btn-lg">
              My Bookings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
