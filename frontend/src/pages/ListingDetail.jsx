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
      const txRes = await api.post('/transactions', { listingId: listing.id, type: 'purchase' });

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

  // 🔥 CREATE CHAT THREAD
  const startChat = async () => {
    setChatError(null);

    if (!userId) {
      setChatError("You must be signed in to message the seller.");
      return;
    }

    try {
      const res = await api.post("/threads", {
        listingId: listing.id,
        buyerId: userId,
        sellerId: listing.seller_id,
      });

      if (!res.data?.id) throw new Error("No thread ID returned from server.");
      setThreadId(res.data.id);
    } catch (err) {
      console.error("Chat error:", err);
      setChatError(err.response?.data?.error ?? err.message ?? "Failed to open chat.");
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

      {/* PAYMENT */}
      {isBuyer && isForSale && <PaymentPanel listing={listing} />}

      {/* MESSAGE SELLER */}
      <div className="detail-card">
        <button onClick={startChat} disabled={roleLoading}>
          💬 {roleLoading ? 'Loading...' : 'Message Seller'}
        </button>
        {chatError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{chatError}</p>}
      </div>

      {/* CHAT BOX */}
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
