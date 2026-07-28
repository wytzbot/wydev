// GET /api/config
// Hands the browser the Paystack PUBLIC key (safe to expose) so it never has
// to be hardcoded in index.html. The SECRET key never leaves this /api folder.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    res.status(500).json({
      error: 'PAYSTACK_PUBLIC_KEY is not set in this project\'s Vercel Environment Variables.'
    });
    return;
  }

  res.status(200).json({ publicKey });
};
