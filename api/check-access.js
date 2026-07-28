// GET /api/check-access?email=someone@example.com
// Lets a user "restore" premium access on a new device/browser without us
// running our own database: we ask Paystack (the source of truth) whether
// this email has any successful transaction of at least the expected
// amount, and unlock locally on the client if so.

const EXPECTED_AMOUNT_KOBO = 350000; // NGN 3,500.00 - keep in sync with PAYMENT_CONFIG in index.html
const EXPECTED_CURRENCY = 'NGN';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ unlocked: false, error: 'PAYSTACK_SECRET_KEY is not set in this project\'s Vercel Environment Variables.' });
    return;
  }

  const rawEmail = (req.query && req.query.email) || '';
  const email = String(rawEmail).trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ unlocked: false, error: 'Missing or invalid email.' });
    return;
  }

  const authHeader = { Authorization: `Bearer ${secretKey}` };

  try {
    // Step 1: resolve the email to a Paystack customer id (transactions can
    // only be filtered by numeric customer id, not raw email).
    const customerRes = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(email)}`, { headers: authHeader });

    if (customerRes.status === 404) {
      res.status(200).json({ unlocked: false });
      return;
    }
    const customerData = await customerRes.json();
    if (!customerRes.ok || !customerData.status || !customerData.data) {
      res.status(200).json({ unlocked: false });
      return;
    }
    const customerId = customerData.data.id;

    // Step 2: list this customer's successful transactions and check for a
    // match on amount/currency.
    const txRes = await fetch(`https://api.paystack.co/transaction?customer=${encodeURIComponent(customerId)}&status=success&perPage=100`, { headers: authHeader });
    const txData = await txRes.json();
    if (!txRes.ok || !txData.status) {
      res.status(200).json({ unlocked: false });
      return;
    }

    const match = (txData.data || []).find(tx =>
      tx.status === 'success' &&
      typeof tx.amount === 'number' &&
      tx.amount >= EXPECTED_AMOUNT_KOBO &&
      tx.currency === EXPECTED_CURRENCY
    );

    if (match) {
      res.status(200).json({ unlocked: true, reference: match.reference, paidAt: match.paid_at });
    } else {
      res.status(200).json({ unlocked: false });
    }
  } catch (err) {
    res.status(500).json({ unlocked: false, error: 'Lookup request to Paystack failed.' });
  }
};
