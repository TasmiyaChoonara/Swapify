import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react'
import api from '../services/api'
import { initiatePayFastPayment, redirectToPayFast } from '../services/payfastService'
import useRole from '../hooks/useRole'
import Chat from '../components/Chat'

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
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const { getToken }          = useAuth()
  const { user }              = useUser()

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const txRes = await api.post('/transactions', { listingId: listing.id, type: 'sale' })
      const transactionId = txRes.data.id
      const result = await initiatePayFastPayment({
        transactionId,
        listingId:       listing.id,
        amount:          listing.price,
        itemName:        listing.title,
        itemDescription: listing.description ?? '',
        nameFirst:       user?.firstName ?? '',
        nameLast:        user?.lastName ?? '',
        email:           user?.emailAddresses?.[0]?.emailAddress ?? '',
      }, token)
      redirectToPayFast(result)
    } catch (err) {
      setError('Payment failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="detail-card" style={{ borderColor: 'rgba(139,92,246,.3)' }}>
      <h3 style={{ color: 'var(--text)', marginBottom: '.25rem' }}>Buy This Item</h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Pay securely via PayFast — supports card, EFT, and more.
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Total price</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>R{parseFloat(listing.price).toFixed(2)}</span>
      </div>
      {error && <p style={{ fontSize: '.85rem', color: 'rgb(239,68,68)', marginBottom: '.75rem' }}>{error}</p>}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handlePay}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
      >
        {loading ? 'Redirecting to PayFast...' : `Pay R${parseFloat(listing.price).toFixed(2)} with PayFast`}
      </button>
    </div>
  )
}

function PaymentCapture() {
  return (
    <div className="detail-card" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
      <p style={{ color: 'rgb(34,197,94)', fontWeight: 600, marginBottom: '.5rem' }}>Payment successful!</p>
      <p style={{ fontSize: '.875rem' }}>Your PayFast payment was completed. Check the trade facility for pickup details.</p>
    </div>
  )
}

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const { isAdmin, userId } = useRole()
  const [listing, setListing]                     = useState(null)
  const [mainImg, setMainImg]                     = useState(null)
  const [loading, setLoading]                     = useState(true)
  const [error, setError]                         = useState(null)
  const [deleting, setDeleting]                   = useState(false)
  const [deleteError, setDeleteError]             = useState(null)
  const [tradeId, setTradeId]                     = useState(null)
  const [chatThreadId, setChatThreadId]           = useState(null)
  const [chatOpen, setChatOpen]                   = useState(false)
  const [chatLoading, setChatLoading]             = useState(false)
  const [sellerTradesCount, setSellerTradesCount] = useState(null)
  const [sellerRating, setSellerRating]           = useState(null)
  const [saved, setSaved]                           = useState(false)
  const [saveLoading, setSaveLoading]               = useState(false)
  const [sellerThreads, setSellerThreads]         = useState([])
  const [activeSellerThread, setActiveSellerThread] = useState(null)

  const urlParams = new URLSearchParams(window.location.search)
  const returningFromPayFast = urlParams.get('payfast') === 'success'

  useEffect(() => {
    setLoading(true)
    api.get(`/listings/${id}`)
      .then(res => {
        setListing(res.data)
        setMainImg(res.data.images?.[0] ?? null)
        const sellerId = res.data.seller_id
        if (sellerId) {
          api.get(`/users/${sellerId}/completed-transactions`)
            .then(r => setSellerTradesCount(r.data.count))
            .catch(() => {})
          api.get(`/ratings/user/${sellerId}`)
            .then(r => setSellerRating(r.data))
            .catch(() => {})
        }
      })
      .catch(() => setError('Listing not found or unavailable.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    api.get(`/transactions?listing_id=${id}`)
      .then(res => {
        if (res.data && res.data.length > 0) setTradeId(res.data[0].id)
      })
      .catch(() => {})
  }, [id])

  // Check if this listing is already saved — must be before any early returns
  useEffect(() => {
    if (!isSignedIn || !id) return
    api.get('/saved')
      .then(res => {
        const savedIds = Array.isArray(res.data) ? res.data.map(s => s.id) : []
        setSaved(savedIds.includes(id))
      })
      .catch(() => {})
  }, [isSignedIn, id])

  if (loading) return <PageShell><div className="spinner" /></PageShell>

  if (error || !listing) return (
    <PageShell>
      <Link to="/" className="back-link">Back to listings</Link>
      <div className="error-banner">{error ?? 'Listing not found.'}</div>
    </PageShell>
  )

  async function handleMessageSeller() {
    setChatLoading(true)
    try {
      const res = await api.post('/threads', { listingId: id, buyerId: userId, sellerId: listing.seller_id })
      setChatThreadId(res.data.id)
      setChatOpen(true)
    } catch {
      // silently ignore
    } finally {
      setChatLoading(false)
    }
  }

  async function handleViewInbox() {
    try {
      const res = await api.get(`/threads/listing/${id}`)
      setSellerThreads(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to load threads:', err)
    }
  }

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



  async function handleSave() {
    if (saveLoading) return
    setSaveLoading(true)
    try {
      if (saved) {
        await api.delete(`/saved/${id}`)
        setSaved(false)
      } else {
        await api.post(`/saved/${id}`)
        setSaved(true)
      }
    } catch {
      // silently fail
    } finally {
      setSaveLoading(false)
    }
  }

  const { title, description, price, condition, type, category, images, created_at, seller_id, seller_name } = listing
  const thumbs = images ?? []
  const displayPrice = type === 'trade' ? 'Trade only' : price != null ? `R${parseFloat(price).toFixed(2)}` : '—'
  const isBuyer  = isSignedIn && seller_id !== userId
  const isSeller = isSignedIn && seller_id === userId
  const isForSale = type === 'sale' || type === 'both'
  const isTrade   = type === 'trade' || type === 'both'

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
              <div className="stat">
                <div className="stat-val">{sellerTradesCount ?? '—'}</div>
                <div className="stat-key">Seller trades</div>
              </div>
            </div>
          </div>

          {/* About the Seller */}
          <div className="detail-card">
            <h3 style={{ color: 'var(--text)', fontSize: '.95rem', marginBottom: '.75rem' }}>About the Seller</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{seller_name ?? '—'}</p>
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                <span>{sellerTradesCount != null ? `${sellerTradesCount} completed trade${sellerTradesCount !== 1 ? 's' : ''}` : 'No trades yet'}</span>
                {sellerRating?.average != null && (
                  <span>&#9733; {sellerRating.average.toFixed(1)} ({sellerRating.count} review{sellerRating.count !== 1 ? 's' : ''})</span>
                )}
              </div>
            </div>
          </div>

          {listing.status === 'sold' && !returningFromPayFast && (
  <div className="detail-card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
    <p style={{ color: 'rgb(239,68,68)', fontWeight: 600, marginBottom: '.25rem' }}>This item has been sold</p>
    <p style={{ fontSize: '.875rem' }}>This listing is no longer available for purchase.</p>
  </div>
)}
{returningFromPayFast && <PaymentCapture />}

          {isSignedIn && isBuyer && (
            <div className="detail-card" style={{ padding: '.75rem 1rem' }}>
              <p style={{ fontSize: '.85rem', margin: 0, color: 'var(--text)' }}>
                <span className="badge badge-purple" style={{ marginRight: '.5rem', verticalAlign: 'middle' }}>Buyer</span>
                You are buying from <strong>{seller_name ?? 'this seller'}</strong>
              </p>
            </div>
          )}

          {isSignedIn && isBuyer && (
            <button
              onClick={handleSave}
              disabled={saveLoading}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,.2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                color: saved ? 'rgb(239,68,68)' : 'var(--text-muted)',
                fontSize: '.85rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '1rem',
              }}
              aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              {saved ? '♥ Saved' : '♡ Save to Wishlist'}
            </button>
          )}

          {isLoaded && isSignedIn && isBuyer && isForSale && listing.status !== 'sold' && !returningFromPayFast && (
            <PaymentPanel listing={listing} />
          )}

          {/* Buyer: Message Seller */}
          {isSignedIn && isBuyer && (
            <div className="detail-card">
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Message Seller</h3>
              {!chatOpen ? (
                <>
                  <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
                    Have a question? Chat directly with the seller.
                  </p>
                  <button
                    className="btn btn-outline btn-full btn-lg"
                    onClick={handleMessageSeller}
                    disabled={chatLoading}
                  >
                    {chatLoading ? 'Opening chat...' : 'Message Seller'}
                  </button>
                </>
              ) : (
                <Chat threadId={chatThreadId} userId={userId} />
              )}
            </div>
          )}

          {/* Seller: View buyer messages */}
          {isSignedIn && isSeller && (
            <div className="detail-card">
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Buyer Messages</h3>
              <button className="btn btn-outline btn-full" onClick={handleViewInbox} style={{ marginBottom: '1rem' }}>
                Load Messages
              </button>
              {sellerThreads.length === 0 && (
                <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>No messages yet — click Load Messages.</p>
              )}
              {sellerThreads.map(thread => (
                <div key={thread.id} style={{ marginBottom: '.5rem' }}>
                  <button
                    className="btn btn-outline btn-full btn-sm"
                    onClick={() => setActiveSellerThread(activeSellerThread === thread.id ? null : thread.id)}
                  >
                    {activeSellerThread === thread.id ? 'Hide' : 'View'} conversation
                  </button>
                  {activeSellerThread === thread.id && (
                    <div style={{ marginTop: '.5rem' }}>
                      <Chat threadId={thread.id} userId={userId} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Trade slot booking card */}
          {isSignedIn && isBuyer && isTrade && (
            <div className="detail-card">
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Interested in a Trade?</h3>
              <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
                Book a campus trade slot to arrange a safe drop-off or collection.
              </p>
              {tradeId ? (
                <Link to={`/book/${tradeId}`} className="btn btn-primary btn-full btn-lg">
                  Book a Trade Slot
                </Link>
              ) : (
                <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate(`/book/${id}`)}>
                  Book a Trade Slot
                </button>
              )}
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
                {isAdmin && seller_id !== userId ? 'Admin Actions' : (
                  <>
                    <span className="badge badge-green" style={{ marginRight: '.5rem', verticalAlign: 'middle' }}>Seller</span>
                    Manage Listing
                  </>
                )}
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
