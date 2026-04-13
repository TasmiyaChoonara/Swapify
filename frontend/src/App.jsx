import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { setTokenGetter } from './services/api'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import CreateListing from './pages/CreateListing'
import ListingDetail from './pages/ListingDetail'
import Admin from './pages/Admin'

// Registers Clerk's getToken with the axios instance so every
// authenticated request automatically gets a Bearer token.
function TokenSync() {
  const { getToken } = useAuth()
  useEffect(() => {
    setTokenGetter(getToken)
    return () => setTokenGetter(null)
  }, [getToken])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenSync />
      <Navbar />
      <Routes>
        <Route path="/"             element={<Home />} />
        <Route path="/listings/new" element={<CreateListing />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/admin"        element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
