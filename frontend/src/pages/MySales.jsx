import { useEffect, useState } from 'react'
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import api from '../services/api'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export default function MySales() {
  const { isSignedIn, isLoaded } = useAuth()
  const [sales, setSales]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!isSignedIn) return
    api.get('/transactions/mine/sold')
      .then(res => setSales(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Failed to load sales history.'))
      .finally(() => setLoading(false))
  }, [isSignedIn])

  if (!isLoaded) return null
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="page">
      <h1 className="page-title">My Sales History</h1>

      {loading && <p className="text-muted">Loading...</p>}
      {error   && <p className="text-danger">{error}</p>}

      {!loading && sales.length === 0 && (
        <p className="text-muted">You have no completed sales yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sales.map(sale => (
          <div key={sale.id} className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="card-title">{sale.listing_title}</p>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    Buyer: {sale.buyer_name}
                  </p>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    Date: {formatDate(sale.created_at)}
                  </p>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    Category: {sale.category}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="card-price">R{parseFloat(sale.price).toFixed(2)}</p>
                  <span className="badge badge-green">Complete</span>
                </div>
              </div>

              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: '.75rem' }}
                onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
              >
                {expanded === sale.id ? 'Hide details' : 'View payment details'}
              </button>

              {expanded === sale.id && (
                <div style={{
                  marginTop: '.75rem',
                  padding: '.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  fontSize: '.85rem'
                }}>
                  <p><strong>Online amount:</strong> R{parseFloat(sale.online_amount ?? 0).toFixed(2)}</p>
                  <p><strong>Cash shortfall:</strong> R{parseFloat(sale.cash_shortfall ?? 0).toFixed(2)}</p>
                  <p><strong>Total:</strong> R{parseFloat(sale.price).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
