// POST /api/verify-payment  { reference: "..." }
// Confirms a just-completed Paystack payment server-side (secret key never
// touches the browser). Only marks a purchase valid if Paystack itself
// reports the transaction as successful, in NGN, for at least the expected
// amount - the client cannot spoof this by editing local storage.

const EXPECTED_AMOUNT_KOBO = 350000; // NGN 3,500.00 - keep in sync with PAYMENT_CONFIG in index.html
const EXPECTED_CURRENCY = 'NGN';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ ok: false, error: 'PAYSTACK_SECRET_KEY is not set in this project\'s Vercel Environment Variables.' });
    return;
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }
  const reference = body && body.reference;
  if (!reference) {
    res.status(400).json({ ok: false, error: 'Missing transaction reference.' });
    return;
  }

  try {
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      res.status(400).json({ ok: false, error: (data && data.message) || 'Could not verify transaction with Paystack.' });
      return;
    }

    const tx = data.data;
    const isSuccessful = tx && tx.status === 'success';
    const amountOk = tx && typeof tx.amount === 'number' && tx.amount >= EXPECTED_AMOUNT_KOBO;
    const currencyOk = tx && tx.currency === EXPECTED_CURRENCY;

    if (isSuccessful && amountOk && currencyOk) {
      res.status(200).json({
        ok: true,
        email: tx.customer && tx.customer.email,
        reference: tx.reference,
        paidAt: tx.paid_at
      });
    } else {
      res.status(400).json({ ok: false, error: 'Payment could not be confirmed for the expected amount.' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Verification request to Paystack failed.' });
  }
};
