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
      <Link to="/" className="back-link">← Back to listings</Link>
      <div className="error-banner">{error ?? 'Listing not found.'}</div>
    </PageShell>
  )

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this listing? This cannot be undone.')) return
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

  const displayPrice = type === 'trade'
    ? 'Trade only'
    : price != null ? `R${parseFloat(price).toFixed(2)}` : '—'

  return (
    <PageShell>
      <Link to="/" className="back-link">← Back to listings</Link>

      <div className="detail-layout">

        {/* ── Left: images ── */}
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
                <img
                  key={i}
                  src={url}
                  alt={`${title} ${i + 1}`}
                  className="detail-thumb"
                  style={mainImg === url ? { borderColor: 'var(--accent)' } : {}}
                  onClick={() => setMainImg(url)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: details ── */}
        <div className="detail-sidebar">

          {/* Main card */}
          <div className="detail-card">
            <div className="meta-row">
              {condition && (
                <span className={`badge ${CONDITION_BADGE[condition] ?? 'badge-muted'}`}>
                  {condition}
                </span>
              )}
              {type && (
                <span className="badge badge-muted">{TYPE_LABEL[type] ?? type}</span>
              )}
              {category && (
                <span className="badge badge-muted">{category}</span>
              )}
            </div>

            <h2 style={{ color: 'var(--text)', fontSize: '1.4rem', marginBottom: '.25rem' }}>
              {title}
            </h2>

            <p className="detail-price">{displayPrice}</p>

            {description && (
              <p style={{ fontSize: '.925rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                {description}
              </p>
            )}

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

          {/* CTA card */}
          <div className="detail-card">
            {isSignedIn ? (
              <>
                <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Interested?</h3>
                <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
                  Send a message to the seller to arrange a meeting on campus.
                </p>
                <button className="btn btn-primary btn-full btn-lg">
                  Contact Seller
                </button>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>Want this item?</h3>
                <p style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
                  Sign in to contact the seller and arrange a swap or purchase.
                </p>
                <SignInButton mode="modal">
                  <button className="btn btn-primary btn-full btn-lg">Sign In to Contact</button>
                </SignInButton>
              </>
            )}
          </div>

          {/* Delete card — visible to owner or admin */}
          {isSignedIn && (isAdmin || seller_id === userId) && (
            <div className="detail-card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
              <h3 style={{ color: 'var(--text)', marginBottom: '.5rem' }}>
                {isAdmin && seller_id !== userId ? 'Admin Actions' : 'Manage Listing'}
              </h3>
              {deleteError && (
                <p className="error-msg" style={{ marginBottom: '.75rem' }}>{deleteError}</p>
              )}
              <button
                className="btn btn-outline btn-full btn-lg"
                style={{ borderColor: 'rgb(239,68,68)', color: 'rgb(239,68,68)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Listing'}
              </button>
            </div>
          )}

        </div>
      </div>
    </PageShell>
  )
}
