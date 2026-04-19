const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function initiatePayFastPayment({ transactionId, listingId, amount, itemName, itemDescription, nameFirst, nameLast, email }, token) {
  const res = await fetch(`${BACKEND_URL}/api/payfast/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ transactionId, listingId, amount, itemName, itemDescription, nameFirst, nameLast, email }),
  });
  if (!res.ok) throw new Error('Failed to initiate PayFast payment');
  return res.json();
}

export function redirectToPayFast({ payfastUrl, paymentData }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payfastUrl;
  Object.entries(paymentData).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}
