import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

const CONDITION_BADGE = {
  new:  'badge-green',
  good: 'badge-purple',
  fair: 'badge-yellow',
}

const TYPE_LABEL = {
  sale:  'For Sale',
  trade: 'Trade',
  both:  'Sale / Trade',
}

function ImagePlaceholder() {
  return (
    <div className="card-img-placeholder">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <span>No image</span>
    </div>
  )
}

export default function ListingCard({ listing }) {
  const { id, title, price, condition, type, category, images, seller_id } = listing
  const thumb = images?.[0]
  const [average, setAverage] = useState(null)

  useEffect(() => {
    if (!seller_id) return
    api.get(`/ratings/user/${seller_id}`)
      .then(res => setAverage(res.data.average))
      .catch(() => {})
  }, [seller_id])

  const displayPrice = type === 'trade'
    ? 'Trade only'
    : price != null
      ? `R${parseFloat(price).toFixed(2)}`
      : null

  return (
    <Link to={`/listings/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card">
        {thumb
          ? <img src={thumb} alt={title} className="card-img" loading="lazy" />
          : <ImagePlaceholder />
        }

        <div className="card-body">
          <p className="card-title">{title}</p>

          {displayPrice && (
            <p className="card-price">{displayPrice}</p>
          )}

          {average !== null && (
            <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.25rem' }}>
              Seller: {average.toFixed(1)} / 5
            </p>
          )}

          <div className="card-meta">
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
        </div>
      </div>
    </Link>
  )
}
