import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, SignInButton } from '@clerk/clerk-react'
import api from '../services/api'
import useRole from '../hooks/useRole'

const CONDITION_BADGE = { new: 'badge-green', good: 'badge-purple', fair: 'badge-yellow' }
const TYPE_LABEL      = { sale: 'For Sale', trade: 'Trade only', both: 'Sale / Trade' }

function PageShell({ children }) {
  return (
    <div className="page">
      <div className="container">{children}</div>
    </div>
  )
}

function PaymentPanel({ listing }) {
  const [totalPrice]      = useState(parseFloat(listing.price ?? 0))
  const [onlineAmount, setOnlineAmount] = useState(parseFloat(listing.price ?? 0))
  const [cashShortfall, setCashShortfall] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)

  function handleOnlineChange(e) {
    const val = parseFloat(e.target.value) || 0
    const clamped = Math.min(val, totalPrice)
    setOnlineAmount(clamped)
    setCashShortfall(+(totalPrice - clamped).toFixed(2))
  }

  async function handlePay() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const txRes = await api.post('/transactions', {
        listingId: listing.id,
        type: listing.type === 'trade' ? 'trade' : 'sale',
      })
      const transactionId = txRes.data.id

      const payRes = await api.post('/payments/initiate', {
        transactionId,
        totalPrice,
        onlineAmount,
        listingId: listing.id,
      })

      const { approvalUrl, cashShortfall: shortfall, paymentId } = payRes.data

      if (approvalUrl) {
        sessionStorage.setItem('swapify_payment', JSON.stringify({ paymentId, transactionId, listingId: listing.id }))
        window.location.href = approvalUrl
      } else {
        setSuccess(`Payment recorded. Cash shortfall of R${shortfall} to be paid at the trade facility.`)
      }
    } catch (err) {
      setError(err.response?.data?.error ?? 'Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="detail-card" style={{ borderColor: 'rgba(139,92,246,.3)' }}>
      <h3 style={{ color: 'var(--text)', marginBottom: '.25rem' }}>Buy This Item</h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Split your payment — pay part online via PayPal and the rest in cash at the trade facility.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '.4rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Total price</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>R{totalPrice.toFixed(2)}</span>
        </div>
        <label style={{ fontSize: '.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.4rem' }}>
          Online amount (PayPal)
        </label>
        <input
          type="number"
          min="0"
          max={totalPrice}
          step="0.01"
          value={onlineAmount}
          onChange={handleOnlineChange}
          style={{
            width: '100%',
            padding: '.6rem .75rem',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(255,255,255,.12)',
            background: 'rgba(255,255,255,.05)',
            color: 'var(--text)',
            fontSize: '.95rem',
            boxSizing: 'border-box',
            marginBottom: '.75rem',
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '.85rem',
          padding: '.6rem .75rem',
          borderRadius: 'var(--radius)',
          background: cashShortfall > 0 ? 'rgba(251,191,36,.08)' : 'rgba(34,197,94,.08)',
          border: cashShortfall > 0 ? '1px solid rgba(251,191,36,.2)' : '1px solid rgba(34,197,94,.2)',
          marginBottom: '1rem',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Cash shortfall at facility</span>
          <span style={{ fontWeight: 600, color: cashShortfall > 0 ? 'rgb(251,191,36)' : 'rgb(34,197,94)' }}>
            R{cashShortfall.toFixed(2)}
          </span>
        </div>
      </div>
      {error && <p style={{ fontSize: '.85rem', color: 'rgb(239,68,68)', marginBottom: '.75rem' }}>{error}</p>}
      {success && <p style={{ fontSize: '.85rem', color: 'rgb(34,197,94)', marginBottom: '.75rem' }}>{success}</p>}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handlePay}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
      >
        {loading ? 'Processing...' : (onlineAmount > 0 ? `Pay R${onlineAmount.toFixed(2)} with PayPal` : 'Record Cash Payment')}
      </button>
    </div>
  )
}

function PaymentCapture() {
  const [status, setStatus] = useState('capturing')

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paypalToken = urlParams.get('token')
    const stored = sessionStorage.getItem('swapify_payment')

    if (!paypalToken || !stored) { setStatus('error'); return }

    const { paymentId } = JSON.parse(stored)
    api.post('/payments/capture', { paymentId, paypalOrderId: paypalToken })
      .then(() => {
        sessionStorage.removeItem('swapify_payment')
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'capturing') return (
    <div className="detail-card">
      <div className="spinner" />
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>Confirming your payment...</p>
    </div>
  )

  if (status === 'success') return (
    <div className="detail-card" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
      <p style={{ color: 'rgb(34,197,94)', fontWeight: 600, marginBottom: '.5rem' }}>Payment confirmed!</p>
      <p style={{ fontSize: '.875rem' }}>Your payment was successful. Check the trade facility for pickup details.</p>
    </div>
  )

  return (
    <div className="detail-card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
      <p style={{ color: 'rgb(239,68,68)', fontWeight: 600 }}>Payment could not be confirmed.</p>
    </div>
  )
}

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { isAdmin, userId } = useRole()
  const [listing, setListing]     = useState(null)
  const [mainImg, setMainImg]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const urlParams = new URLSearchParams(window.location.search)
  const returningFromPayPal = urlParams.get('paypal') === 'success'

  useEffect(() => {
    setLoading(true)
    api.get(`/listings/${id}`)
      .then(res => {
        setListing(res.data)
        setMainImg(res.data.images?.[0] ?? null)
      })
      .catch(() => setError('Listing not found or unavailable.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageShell><div className="spinner" /></PageShell>

  if (error || !listing) return (
    <PageShell>
      <Link to="/" className="back-link">Back to listings</Link>
      <div className="error-banner">{error ?? 'Listing not found.'}</div>
    </PageShell>
  )

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this listing?')) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/listings/${id}`)
      navigate('/')
    } catch (err) {
      setDeleteError(err.response?.data?.error ?? 'Failed to delete listing.')
      setDeleting(false)
    }
  }

  const { title, description, price, condition, type, category, images, created_at, seller_id } = listing
  const thumbs = images ?? []
  const displayPrice = type === 'trade' ? 'Trade only' : price != null ? `R${parseFloat(price).toFixed(2)}` : '—'
  const isBuyer = isSignedIn && seller_id !== userId
  const isForSale = type === 'sale' || type === 'both'

  return (
    <PageShell>
      <Link to="/" className="back-link">Back to listings</Link>
      <div className="detail-layout">
        <div className="detail-image-wrap">
          {mainImg ? (
            <img src={mainImg} alt={title} className="detail-main-img" />
          ) : (
            <div className="card-img-placeholder" style={{ height: 380, borderRadius: 'var(--radius-lg)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
              <span>No image</span>
            </div>
          )}
          {thumbs.length > 1 && (
            <div className="detail-thumbs">
              {thumbs.map((url, i) => (
                <img key={i} src={url} alt={`${title} ${i + 1}`} className="detail-thumb"
                  style={mainImg === url ? { borderColor: 'var(--accent)' } : {}}
                  onClick={() => setMainImg(url)} />
              ))}
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="detail-card">
            <div className="meta-row">
              {condition && <span className={`badge ${CONDITION_BADGE[condition] ?? 'badge-muted'}`}>{condition}</span>}
              {type && <span className="badge badge-muted">{TYPE_LABEL[type] ?? type}</span>}
              {category && <span className="badge badge-muted">{category}</span>}
            </div>
            <h2 style={{ color: 'var(--text)', fontSize: '1.4rem', marginBottom: '.25rem' }}>{title}</h2>
            <p className="detail-price">{displayPrice}</p>
            {description && <p style={{ fontSize: '.925rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>{description}</p>}
            <div className="stat-row">
              <div className="stat">
                <div className="stat-val">{condition ?? '—'}</div>
                <div className="stat-key">Condition</div>
              </div>
              <div className="stat">
                <div className="stat-val">{TYPE_LABEL[type] ?? type ?? '—'}</div>
                <div className="stat-key">Type</div>
              </div>
              <div className="stat">
                <div className="stat-val">{new Date(created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div className="stat-key">Listed</div>
              </div>
            </div>
          </div>

          {returningFromPayPal && <PaymentCapture />}

          {isSignedIn && isBuyer && isForSale && !returningFromPayPal && (
            <PaymentPanel listing={listing} />
          )}

          {isSignedIn && isBuyer && !isForSale && (
            <div className="detail-card">
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Interested in a Trade?</h3>
              <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>Contact the seller to arrange a trade on campus.</p>
              <button className="btn btn-primary btn-full btn-lg">Contact Seller</button>
            </div>
          )}

          {!isSignedIn && (
            <div className="detail-card">
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Want this item?</h3>
              <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>Sign in to buy or arrange a swap.</p>
              <SignInButton mode="modal">
                <button className="btn btn-primary btn-full btn-lg">Sign In to Buy</button>
              </SignInButton>
            </div>
          )}

          {isSignedIn && (isAdmin || seller_id === userId) && (
            <div className="detail-card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>
                {isAdmin && seller_id !== userId ? 'Admin Actions' : 'Manage Listing'}
              </h3>
              {deleteError && <p className="error-msg" style={{ marginBottom: '.75rem' }}>{deleteError}</p>}
              <button
                className="btn btn-outline btn-full btn-lg"
                style={{ borderColor: 'rgb(239,68,68)', color: 'rgb(239,68,68)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Listing'}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
