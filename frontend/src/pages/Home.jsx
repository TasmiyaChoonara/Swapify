import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'
import ListingCard from '../components/ListingCard'

const CATEGORIES = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Sports', 'Other']
const EMPTY_FILTERS = { category: '', type: '', condition: '' }

export default function Home() {
  const { isSignedIn } = useAuth()
  const [listings, setListings] = useState([])
  const [filters, setFilters]   = useState(EMPTY_FILTERS)
  const [applied, setApplied]   = useState(EMPTY_FILTERS)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== ''))
    api.get('/listings', { params })
      .then(res => setListings(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Failed to load listings.'))
      .finally(() => setLoading(false))
  }, [applied])

  // Filter listings locally by search term
  const filtered = search.trim()
    ? listings.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))
    : listings

  function handleFilterChange(e) {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function applyFilters(e) {
    e.preventDefault()
    setApplied({ ...filters })
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setSearch('')
  }

  // Triggered by Search button or pressing Enter in the search input
  function handleSearch(e) {
    e.preventDefault()
    // search state is already bound to the input via onChange,
    // so filtered will update automatically — nothing extra needed
  }

  const hasActiveFilters = Object.values(applied).some(Boolean) || search.trim()

  return (
    <div className="page">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <span>✦</span> Campus Marketplace
          </div>
          <h1 className="hero-title">
            Buy, Sell &amp; Trade<br />
            <span>on Campus</span>
          </h1>
          <p className="hero-sub">
            The fastest way to find textbooks, electronics, furniture and more,
            all from students at your university.
          </p>

          {/* ── Search bar ── */}
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search listings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search listings"
            />
            <button type="submit" className="btn btn-primary search-btn">
              Search
            </button>
          </form>

        </div>
      </section>

      <div className="container">

        {/* ── Filter bar ── */}
        <form className="filter-bar" onSubmit={applyFilters}>
          <div className="form-group">
            <label>Category</label>
            <select name="category" value={filters.category} onChange={handleFilterChange}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c.toLowerCase()}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="">Any type</option>
              <option value="sale">For Sale</option>
              <option value="trade">Trade</option>
              <option value="both">Sale / Trade</option>
            </select>
          </div>
          <div className="form-group">
            <label>Condition</label>
            <select name="condition" value={filters.condition} onChange={handleFilterChange}>
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </select>
          </div>
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary btn-sm">Apply</button>
            {hasActiveFilters && (
              <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
                Clear
              </button>
            )}
          </div>
        </form>

        {/* ── Post a listing CTA ── */}
        {isSignedIn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <Link to="/listings/new" className="btn btn-primary btn-sm">
              + Post a Listing
            </Link>
          </div>
        )}

        {/* ── Results header ── */}
        <div className="section-header">
          <h2>
            {hasActiveFilters ? 'Filtered Results' : 'Recent Listings'}
          </h2>
          {!loading && !error && (
            <span className="result-count">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {/* ── States ── */}
        {loading && <div className="spinner" />}

        {!loading && error && (
          <div className="error-banner">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No listings found</h3>
            <p>
              {hasActiveFilters
                ? 'Try adjusting your filters or search term.'
                : 'Be the first to post something!'}
            </p>
            {isSignedIn && (
              <Link to="/listings/new" className="btn btn-primary" style={{ marginTop: '.5rem' }}>
                + Post a Listing
              </Link>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="listing-grid">
            {filtered.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}

      </div>
    </div>
  )
}