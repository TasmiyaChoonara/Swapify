import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import api from '../services/api'

export default function SavedListings() {
  const { isSignedIn, isLoaded } = useAuth()
  const [saved, setSaved]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!isSignedIn) return
    api.get('/saved')
      .then(res => setSaved(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Failed to load saved listings.'))
      .finally(() => setLoading(false))
  }, [isSignedIn])

  async function handleUnsave(listingId) {
    try {
      await api.delete(`/saved/${listingId}`)
      setSaved(prev => prev.filter(s => s.id !== listingId))
    } catch {
      alert('Failed to remove listing.')
    }
  }

  if (!isLoaded) return null
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="page">
      <h1 className="page-title">My Saved Listings</h1>

      {loading && <p className="text-muted">Loading...</p>}
      {error   && <p className="text-danger">{error}</p>}

      {!loading && saved.length === 0 && (
        <p className="text-muted">You have no saved listings. Browse listings and click the heart icon to save them.</p>
      )}

      <div className="card-grid">
        {saved.map(item => (
          <div key={item.saved_id} className="card">
            <div className="card-body">
              <p className="card-title">{item.title}</p>
              {item.price && (
                <p className="card-price">R{parseFloat(item.price).toFixed(2)}</p>
              )}
              <div className="card-meta">
                {item.condition && <span className="badge badge-muted">{item.condition}</span>}
                {item.category  && <span className="badge badge-muted">{item.category}</span>}
                {item.status === 'sold' && <span className="badge badge-red">Sold</span>}
              </div>
              <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                Seller: {item.seller_name}
              </p>
              <p style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                Saved: {new Date(item.saved_at).toLocaleDateString()}
              </p>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                <Link to={`/listings/${item.id}`} className="btn btn-primary btn-sm">
                  View Listing
                </Link>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleUnsave(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
