# Wytelab → WyCode Market payment webhook patch

This is a drop-in reference webhook adapter, not a replacement for the full Wytelab application.

Purpose:
- Wytelab remains the only service holding Flutterwave credentials.
- Flutterwave sends its v4 webhook to Wytelab.
- Wytelab verifies Flutterwave webhook authenticity using the configured `verif-hash` secret-hash header (with HMAC compatibility only if your existing Wytelab integration explicitly uses that mode).
- Wytelab verifies critical payment data before granting value.
- Wytelab forwards a minimal, signed event to WyCode Market `/api/webhook`.
- WyCode Market never receives Flutterwave credentials.

Required Wytelab environment variables:
- FLW_WEBHOOK_SECRET — Flutterwave webhook secret hash configured in Flutterwave.
- WYCOD_MARKET_WEBHOOK_URL — WyCode Market `/api/webhook` URL.
- WYCOD_MARKET_WEBHOOK_SECRET — shared HMAC secret used to sign the forwarded event.

Forwarded event contract:
{
  "id": "unique-event-id",
  "type": "payment.completed",
  "source": "wytelab",
  "data": {
    "order_id": "WyCode order ID or seller plan order ID",
    "reference": "Flutterwave reference",
    "charge_id": "Flutterwave charge ID",
    "status": "succeeded",
    "amount": 20,
    "currency": "USD",
    "next_action": null,
    "meta": {}
  }
}

IMPORTANT: Replace the forwarding function with the existing Wytelab webhook handler's database/verification logic if Wytelab already owns those responsibilities. Do not deploy this as a second Flutterwave webhook URL unless you intend to move the webhook endpoint.

Market requirement when using the forwarded event: set WYCOD_MARKET_WEBHOOK_SECRET on Market to the same shared secret. Market validates the forwarded amount, currency, reference and order ID before granting value, and its paid-order update is idempotent.
