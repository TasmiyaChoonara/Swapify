import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import api from '../services/api'

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function BookSlot() {
  const { trade_id } = useParams()
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()

  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots]               = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState(null)
  const [success, setSuccess]           = useState(null)
  const [existingBooking, setExisting]  = useState(null)
  const [loadingBooking, setLoadingBooking] = useState(true)

  useEffect(() => {
    if (!trade_id) return
    api.get(`/bookings/${trade_id}`)
      .then(res => {
        if (res.data && res.data.length > 0) setExisting(res.data[0])
      })
      .catch(() => {})
      .finally(() => setLoadingBooking(false))
  }, [trade_id])

  useEffect(() => {
    if (!selectedDate) { setSlots([]); return }
    setLoadingSlots(true)
    setError(null)
    setSelectedSlot(null)
    api.get(`/slots?date=${selectedDate}`)
      .then(res => setSlots(res.data))
      .catch(() => setError('Failed to load slots. Please try again.'))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  if (!isLoaded) return <div className="page"><div className="container"><div className="spinner" /></div></div>
  if (!isSignedIn) return <RedirectToSignIn />

  async function handleBook() {
    if (!selectedSlot) return
    setSubmitting(true)
    setError(null)
    try {
      const slotIso = new Date(selectedSlot).toISOString()
      await api.post('/bookings', {
        trade_id,
        slot_time: slotIso,
      })
      setSuccess(slotIso)
      setExisting({ slot_time: slotIso, status: 'booked' })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Server error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page form-page">
      <div className="container form-container">

        <Link to="/" className="back-link">Back to listings</Link>

        <div className="form-card">
          <div className="form-card-header">
            <h1>Book a Trade Slot</h1>
            <p>Select a date and available time slot for your campus exchange.</p>
          </div>

          <div className="info-banner">
            Slots are available Monday - Friday, <strong>08:00 - 18:00</strong>
          </div>

          {loadingBooking && <div className="spinner" />}

          {!loadingBooking && existingBooking && !success && (
            <div className="success-banner">
              You already have a booking for this trade at{' '}
              <strong>{formatTime(existingBooking.slot_time)}</strong> —{' '}
              status: <strong>{existingBooking.status}</strong>
            </div>
          )}

          {success && (
            <div className="success-banner">
              Slot booked successfully for <strong>{formatTime(success)}</strong>.
              Both parties will see this booking.
            </div>
          )}

          {!existingBooking && !success && (
            <>
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Select Date</label>
                <input
                  type="date"
                  min={today()}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>

              {selectedDate && (
                <div className="form-group">
                  <label>
                    Available Slots — <span style={{ fontWeight: 400 }}>{formatDate(selectedDate)}</span>
                  </label>

                  {loadingSlots && <div className="spinner" />}

                  {!loadingSlots && slots.length === 0 && (
                    <p className="form-hint">No slots available for this date.</p>
                  )}

                  {!loadingSlots && slots.length > 0 && (
                    <div className="slot-grid">
                      {slots.map((slot, i) => {
                        const isSelected = selectedSlot === slot.time
                        const isBooked   = !slot.available
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`slot-btn ${isBooked ? 'slot-btn--booked' : ''} ${isSelected ? 'slot-btn--selected' : ''}`}
                            disabled={isBooked}
                            onClick={() => setSelectedSlot(slot.time)}
                          >
                            {formatTime(slot.time)}
                            {isBooked && <span className="slot-badge">Taken</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {error && <div className="error-banner">{error}</div>}

              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.75rem' }}>
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!selectedSlot || submitting}
                  onClick={handleBook}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => navigate('/')}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
