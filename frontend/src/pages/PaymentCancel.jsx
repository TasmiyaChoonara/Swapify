import { useSearchParams, Link } from 'react-router-dom';

export default function PaymentCancel() {
  const [params] = useSearchParams();
  const listingId = params.get('listing');
  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <h1>❌ Payment Cancelled</h1>
      <p>Your payment was not completed.</p>
      <Link to={`/listings/${listingId}`}>Try Again</Link>
    </div>
  );
}
