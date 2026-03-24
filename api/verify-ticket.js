// ══════════════════════════════════════════════════════════════
// HDMP v3.0 — Server-side Ticket Verification
// Validates ticket authenticity using HMAC signatures
// Prevents localStorage manipulation attacks
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const TICKET_SECRET = process.env.TICKET_SECRET || process.env.NWC_URL || 'hdmp-default-secret';

// Generate HMAC signature for ticket data
function signTicket(data) {
  const payload = `${data.eventId}:${data.name}:${data.paymentHash}:${data.amount}:${data.timestamp}`;
  return crypto.createHmac('sha256', TICKET_SECRET).update(payload).digest('hex');
}

// Verify HMAC signature
function verifySignature(data, signature) {
  const expected = signTicket(data);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, ticket } = req.body;

  if (action === 'sign') {
    // Sign a new ticket after payment verification
    if (!ticket?.eventId || !ticket?.paymentHash || !ticket?.amount) {
      return res.status(400).json({ error: 'Missing ticket fields' });
    }

    const ticketData = {
      eventId: ticket.eventId,
      name: ticket.name || 'Anónimo',
      paymentHash: ticket.paymentHash,
      amount: parseInt(ticket.amount, 10),
      timestamp: Date.now()
    };

    const signature = signTicket(ticketData);

    return res.status(200).json({
      ticket: { ...ticketData, signature },
      valid: true
    });
  }

  if (action === 'verify') {
    // Verify an existing ticket
    if (!ticket?.signature || !ticket?.eventId || !ticket?.paymentHash) {
      return res.status(400).json({ valid: false, error: 'Missing ticket data' });
    }

    try {
      const valid = verifySignature({
        eventId: ticket.eventId,
        name: ticket.name || 'Anónimo',
        paymentHash: ticket.paymentHash,
        amount: parseInt(ticket.amount, 10),
        timestamp: ticket.timestamp
      }, ticket.signature);

      return res.status(200).json({ valid });
    } catch (err) {
      return res.status(200).json({ valid: false, error: 'Invalid signature format' });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use "sign" or "verify"' });
}
