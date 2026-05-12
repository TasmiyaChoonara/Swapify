import { useSearchParams, Link } from 'react-router-dom'

export default function PaymentCancel() {
  const [params] = useSearchParams()
  const listingId = params.get('listing')

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
            background: 'rgba(239,68,68,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            fontSize: '1.75rem',
            color: 'rgb(239,68,68)',
          }}>
            &#10005;
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)' }}>
            Payment cancelled
          </h1>

          <p style={{ fontSize: '.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your payment was cancelled and you have not been charged.
            The listing is still available if you change your mind.
          </p>

          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '.5rem', flexWrap: 'wrap' }}>
            {listingId && (
              <Link to={`/listings/${listingId}`} className="btn btn-outline btn-lg">
                Back to Listing
              </Link>
            )}
            <Link to="/" className="btn btn-primary btn-lg">
              Browse Listings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
