import crypto from 'node:crypto';

function signatureValid(raw, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cleanStatus(value) {
  const s = String(value || '').toLowerCase();
  return s === 'successful' ? 'succeeded' : s;
}

function successStatus(value) {
  return ['succeeded', 'successful'].includes(String(value || '').toLowerCase());
}

/**
 * Use this inside the existing Wytelab Flutterwave webhook after Wytelab has
 * verified the Flutterwave event/transaction. It intentionally forwards only
 * the fields WyCode needs; do not forward card data or other sensitive fields.
 */
export async function forwardVerifiedWyCodePayment({ flutterwavePayload, verifiedCharge }) {
  const marketUrl = String(process.env.WYCOD_MARKET_WEBHOOK_URL || '').trim();
  const sharedSecret = String(process.env.WYCOD_MARKET_WEBHOOK_SECRET || '').trim();
  if (!marketUrl || !sharedSecret) throw new Error('WyCode Market webhook configuration is missing.');

  const payload = flutterwavePayload || {};
  const charge = verifiedCharge || payload.data || {};
  const meta = charge.meta || payload.data?.meta || {};
  const orderId = String(meta.order_id || meta.orderId || meta.seller_plan_order_id || '').trim();
  const reference = String(charge.reference || meta.reference || '').trim();
  const amount = Number(charge.amount);
  const currency = String(charge.currency || '').toUpperCase();
  const status = cleanStatus(charge.status);

  if (!orderId || !reference || !Number.isFinite(amount) || amount <= 0 || !currency || !successStatus(status)) {
    return { forwarded: false, reason: 'Payment is not a verified successful WyCode payment.' };
  }

  const event = {
    id: String(payload.id || payload.webhook_id || `${reference}:${orderId}`),
    type: 'payment.completed',
    source: 'wytelab',
    data: {
      order_id: orderId,
      reference,
      charge_id: String(charge.id || ''),
      status: 'succeeded',
      amount,
      currency,
      next_action: charge.next_action || null,
      meta: {
        product_id: String(meta.product_id || ''),
        buyer_uid: String(meta.buyer_uid || ''),
        seller_uid: String(meta.seller_uid || ''),
        plan: String(meta.plan || ''),
        cycle: String(meta.cycle || '')
      }
    }
  };

  const raw = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', sharedSecret).update(raw).digest('base64');
  const response = await fetch(marketUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wytelab-Signature': signature,
      'X-Wytelab-Event-Id': event.id
    },
    body: raw
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`WyCode Market webhook returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return { forwarded: true, eventId: event.id };
}

/**
 * Optional helper for a Wytelab route that receives the raw Flutterwave body.
 * Current Flutterwave v4 webhooks use the `flutterwave-signature` header and
 * HMAC-SHA256 with the merchant's configured webhook secret hash.
 */
export function validateFlutterwaveWebhook(rawBody, headers = {}) {
  const configured = String(process.env.FLW_WEBHOOK_SECRET || '').trim();
  if (!configured) return false;
  const secretHash = String(headers['verif-hash'] || headers['Verif-Hash'] || '').trim();
  if (secretHash) {
    if (secretHash.length !== configured.length) return false;
    return crypto.timingSafeEqual(Buffer.from(secretHash), Buffer.from(configured));
  }
  const signature = headers['flutterwave-signature'] || headers['Flutterwave-Signature'];
  return signatureValid(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || '')), signature, configured);
}
