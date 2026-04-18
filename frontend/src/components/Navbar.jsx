import { Link } from 'react-router-dom'
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react'
import useRole from '../hooks/useRole'

export default function Navbar() {
  const { isSignedIn } = useAuth()
  const { isAdmin } = useRole()

  return (
    <nav className="navbar">
      <div className="container navbar-inner">

        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="swap-icon" aria-hidden="true">⇄</span>
          Swap<span className="brand-accent">ify</span>
        </Link>

        {/* Nav links */}
        <div className="navbar-links">
          <Link to="/" className="navbar-link">Home</Link>

          {isSignedIn ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="navbar-link">Admin Panel</Link>
              )}
              <Link to="/my-bookings" className="navbar-link">My Bookings</Link>
              <Link to="/listings/new" className="btn btn-primary btn-sm">
                + Sell Item
              </Link>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="btn btn-ghost btn-sm">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-primary btn-sm">Get Started</button>
              </SignUpButton>
            </>
          )}
        </div>

      </div>
    </nav>
  )
}