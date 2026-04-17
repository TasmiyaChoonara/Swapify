import { useSearchParams, Link } from 'react-router-dom';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const listingId = params.get('listing');
  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <h1>✅ Payment Successful!</h1>
      <p>Your payment for listing #{listingId} has been received.</p>
      <Link to="/">Back to Marketplace</Link>
    </div>
  );
}
