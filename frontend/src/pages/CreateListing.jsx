import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import api from '../services/api'

const CATEGORIES = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Sports', 'Other']
const INITIAL = { title: '', description: '', price: '', condition: '', type: '', category: '' }

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function uploadToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in frontend/.env'
    )
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Cloudinary upload failed (${res.status})`)
  }
  return (await res.json()).secure_url
}

// ── Price suggestion hook ──────────────────────────────────────────────────
function usePriceSuggestion(category, title) {
  const [suggestion, setSuggestion] = useState(null)
  const [loadingSug, setLoadingSug] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!category) { setSuggestion(null); return }

    // Debounce — wait 500 ms after the user stops typing the title
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingSug(true)
      try {
        const params = new URLSearchParams({ category })
        if (title.trim()) params.append('item', title.trim())
        const res = await api.get(`/prices/suggest?${params}`)
        setSuggestion(res.status === 204 ? null : res.data)
      } catch {
        setSuggestion(null)
      } finally {
        setLoadingSug(false)
      }
    }, 500)

    return () => clearTimeout(debounceRef.current)
  }, [category, title])

  return { suggestion, loadingSug }
}

// ── Price suggestion badge ─────────────────────────────────────────────────
function PriceSuggestion({ suggestion, loading }) {
  if (loading) {
    return (
      <p className="price-suggestion price-suggestion--loading">
        <span className="price-suggestion-dot" /> Fetching price suggestion…
      </p>
    )
  }
  if (!suggestion) return null

  const { min, median, max, matchedItem } = suggestion
  const label = matchedItem ?? null

  return (
    <p className="price-suggestion">
      <span className="price-suggestion-icon">💡</span>
      Suggested range
      {label && <span className="price-suggestion-label"> for "{label}"</span>}
      {': '}
      <strong>R{min.toLocaleString()} – R{median.toLocaleString()}</strong>
      <span className="price-suggestion-max"> (up to R{max.toLocaleString()})</span>
    </p>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CreateListing() {
  const { isSignedIn, isLoaded } = useAuth()
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [form, setForm]               = useState(INITIAL)
  const [imageFile, setImageFile]     = useState(null)
  const [imagePreview, setPreview]    = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [error, setError]             = useState(null)
  const [submitting, setSub]          = useState(false)

  const { suggestion, loadingSug } = usePriceSuggestion(form.category, form.title)

  if (!isLoaded) return <div className="page"><div className="container"><div className="spinner" /></div></div>
  if (!isSignedIn) return <RedirectToSignIn />

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Please select an image file.'); return }
    if (file.size > 10 * 1024 * 1024)    { setUploadError('Image must be under 10 MB.'); return }
    setUploadError(null)
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setPreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setPreview(null)
    setUploadError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSub(true)
    try {
      const res = await api.post('/listings', {
        ...form,
        price: form.price === '' ? null : parseFloat(form.price),
      })
      const listingId = res.data.id

      if (imageFile) {
        setUploading(true)
        const imageUrl = await uploadToCloudinary(imageFile)
        setUploading(false)
        await api.post(`/listings/${listingId}/images`, { imageUrl })
      }

      navigate(`/listings/${listingId}`)
    } catch (err) {
      setUploading(false)
      setError(err.response?.data?.error ?? err.message ?? 'Failed to create listing.')
      setSub(false)
    }
  }

  const showPrice = form.type === 'sale' || form.type === 'both'
  const isBusy    = submitting || uploading

  return (
    <div className="page form-page">
      <div className="container form-container">

        <Link to="/" className="back-link">← Back to listings</Link>

        <div className="form-card">
          <div className="form-card-header">
            <h1>List an Item</h1>
            <p>Fill in the details below to post your item to the marketplace.</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── Title ── */}
            <div className="form-group">
              <label>Title *</label>
              <input
                name="title" value={form.title} onChange={handleChange}
                placeholder="e.g. Introduction to Algorithms, 3rd Ed."
                required
              />
            </div>

            {/* ── Description ── */}
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description" value={form.description} onChange={handleChange}
                placeholder="Describe the item — condition details, edition, accessories included…"
              />
            </div>

            <hr className="form-divider" />

            {/* ── Image upload ── */}
            <div className="form-group">
              <label>Photo</label>
              {imagePreview ? (
                <div className="upload-preview">
                  <img src={imagePreview} alt="Preview" className="upload-preview-img" />
                  <button type="button" className="upload-remove-btn" onClick={removeImage} aria-label="Remove image">✕</button>
                </div>
              ) : (
                <div
                  className="upload-dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (file) handleFileChange({ target: { files: [file] } })
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: .4 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="upload-dropzone-text">Click or drag &amp; drop to upload</span>
                  <span className="upload-dropzone-hint">PNG, JPG, WEBP · max 10 MB</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              {uploadError && <p className="error-msg" style={{ marginTop: '.4rem' }}>{uploadError}</p>}
            </div>

            <hr className="form-divider" />

            {/* ── Type / Condition / Category ── */}
            <div className="form-row">
              <div className="form-group">
                <label>Listing Type *</label>
                <select name="type" value={form.type} onChange={handleChange} required>
                  <option value="">Select type</option>
                  <option value="sale">For Sale</option>
                  <option value="trade">Trade</option>
                  <option value="both">Sale / Trade</option>
                </select>
              </div>

              <div className="form-group">
                <label>Condition *</label>
                <select name="condition" value={form.condition} onChange={handleChange} required>
                  <option value="">Select condition</option>
                  <option value="new">New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c.toLowerCase()}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Price + suggestion ── */}
            {showPrice && (
              <div className="form-group">
                <label>Price (ZAR){form.type !== 'both' && ' *'}</label>
                <input
                  name="price" type="number" min="0" step="0.01"
                  value={form.price} onChange={handleChange}
                  placeholder="0.00"
                  required={form.type === 'sale'}
                />
                {/* Show suggestion only when there's a price field */}
                <PriceSuggestion suggestion={suggestion} loading={loadingSug} />
                {!loadingSug && !suggestion && form.category && (
                  <p className="form-hint">Select a category to see a suggested price range.</p>
                )}
                {form.type === 'both' && !suggestion && (
                  <p className="form-hint">Optional — leave blank if you prefer trade only</p>
                )}
              </div>
            )}

            {/* ── Suggestion shown even when price is hidden (trade items) ── */}
            {!showPrice && form.category && (
              <PriceSuggestion suggestion={suggestion} loading={loadingSug} />
            )}

            {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.75rem' }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={isBusy} style={{ flex: 1 }}>
                {uploading ? 'Uploading image…' : submitting ? 'Posting…' : 'Post Listing'}
              </button>
              <button type="button" className="btn btn-outline btn-lg" onClick={() => navigate('/')} disabled={isBusy}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
