import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import api from '../services/api'

export default function useRole() {
  const { isSignedIn, isLoaded } = useAuth()
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setUser(null); setLoading(false); return }

    api.get('/users/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [isSignedIn, isLoaded])

  const role = user?.role ?? null

  return {
    role,
    userId: user?.id ?? null,
    loading,
    isAdmin:   role === 'admin',
    isStaff:   role === 'staff',
    isStudent: role === 'student',
  }
}
