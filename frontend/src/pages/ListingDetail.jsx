import Chat from "../components/Chat";
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import api from '../services/api';
import { initiatePayFastPayment, redirectToPayFast } from '../services/payfastService';
import useRole from '../hooks/useRole';

const CONDITION_BADGE = { new: 'badge-green', good: 'badge-purple', fair: 'badge-yellow' };
const TYPE_LABEL = { sale: 'For Sale', trade: 'Trade only', both: 'Sale / Trade' };

function PageShell({ children }) {
  return (
    <div className="page">
      <div className="container">{children}</div>
    </div>
  );
}

function SellerRatings({ sellerId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!sellerId) return
    api.get(`/ratings/user/${sellerId}`)
      .then(res => setData(res.data))
      .catch(() => {})
  }, [sellerId])

  if (!data) return null

  return (
    <div style={{ marginTop: '.5rem' }}>
      <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
        {data.average !== null
          ? `${data.average.toFixed(1)} / 5 (${data.count} ${data.count === 1 ? 'rating' : 'ratings'})`
          : 'No ratings yet'}
      </p>
      {data.ratings.slice(0, 5).map(r => (
        <div key={r.id} style={{ marginTop: '.5rem', padding: '.5rem', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,.07)' }}>
          <p style={{ fontSize: '.8rem', color: 'var(--text)', marginBottom: '.2rem' }}>
            {r.reviewer_name} — {r.score}/5
          </p>
          {r.comment && <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{r.comment}</p>}
          <p style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
            {new Date(r.created_at).toLocaleDateString('en-ZA')}
          </p>
        </div>
      ))}
    </div>
  )
}

function PaymentPanel({ listing }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getToken } = useAuth();
  const { user } = useUser();

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const txRes = await api.post('/transactions', { listingId: listing.id, type: 'sale' });
      const result = await initiatePayFastPayment({
        transactionId: txRes.data.id,
        listingId: listing.id,
        amount: listing.price,
        itemName: listing.title,
        itemDescription: listing.description ?? '',
        nameFirst: user?.firstName ?? '',
        nameLast: user?.lastName ?? '',
        email: user?.emailAddresses?.[0]?.emailAddress ?? '',
      }, token);
      redirectToPayFast(result);
    } catch (err) {
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="detail-card">
      <h3>Buy This Item</h3>
      {error && <p>{error}</p>}
      <button onClick={handlePay} disabled={loading}>
        {loading ? 'Redirecting...' : `Pay R${listing.price}`}
      </button>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const { isAdmin, userId, loading: roleLoading } = useRole();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadId, setThreadId] = useState(null);
  const [chatError, setChatError] = useState(null);

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(res => setListing(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!listing || !userId || !isSignedIn) return;
    if (listing.seller_id !== userId) return;
    api.get(`/threads/listing/${listing.id}`)
      .then(res => {
        if (res.data && res.data.length > 0) setThreadId(res.data[0].id);
      })
      .catch(() => {});
  }, [listing, userId, isSignedIn]);

  const startChat = async () => {
    setChatError(null);
    if (!isSignedIn) { setChatError('You must be signed in to message the seller.'); return; }
    if (!userId) { setChatError('Still loading your profile, please try again.'); return; }
    const isSeller = listing.seller_id === userId;

    // Sellers only view existing threads, never create one (buyer_id would be null)
    if (isSeller) {
      try {
        const res = await api.get(`/threads/listing/${listing.id}`);
        if (res.data && res.data.length > 0) {
          setThreadId(res.data[0].id);
        } else {
          setChatError('No messages yet for this listing.');
        }
      } catch (err) {
        setChatError(err.response?.data?.error ?? err.message ?? 'Failed to load messages.');
      }
      return;
    }

    // Only buyers create threads
    try {
      const res = await api.post('/threads', {
        listingId: listing.id,
        buyerId: userId,
        sellerId: listing.seller_id,
      });
      if (!res.data?.id) throw new Error('No thread ID returned from server.');
      setThreadId(res.data.id);
    } catch (err) {
      setChatError(err.response?.data?.error ?? err.message ?? 'Failed to open chat.');
    }
  };

  if (loading) return <PageShell>Loading...</PageShell>;
  if (!listing) return <PageShell>Not found</PageShell>;

  const isBuyer = isSignedIn && listing.seller_id !== userId;
  const isForSale = listing.type === 'sale' || listing.type === 'both';

  return (
    <PageShell>
      <Link to="/">Back</Link>

      <h2>{listing.title}</h2>
      <p>R{listing.price}</p>

      <div style={{ marginTop: '.5rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Seller</p>
        <SellerRatings sellerId={listing.seller_id} />
      </div>

      {isBuyer && isForSale && <PaymentPanel listing={listing} />}

      {isSignedIn && listing.seller_id === userId && (
        <div className="detail-card">
          <button onClick={startChat} disabled={!isLoaded || roleLoading}>
            {(!isLoaded || roleLoading) ? 'Loading...' : 'View Messages'}
          </button>
          {chatError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{chatError}</p>}
        </div>
      )}

      {isBuyer && (
        <div className="detail-card">
          <button onClick={startChat} disabled={!isLoaded || roleLoading}>
            {(!isLoaded || roleLoading) ? 'Loading...' : 'Message Seller'}
          </button>
          {chatError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{chatError}</p>}
        </div>
      )}

      {threadId && (
        <div className="detail-card">
          <Chat threadId={threadId} userId={userId} />
        </div>
      )}

      {!isSignedIn && (
        <SignInButton mode="modal">
          <button>Sign in to interact</button>
        </SignInButton>
      )}
    </PageShell>
  );
}
