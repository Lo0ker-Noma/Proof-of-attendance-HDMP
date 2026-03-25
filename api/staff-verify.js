// ══════════════════════════════════════════════════════════════
// HDMP v3.0 — Staff PIN Verification & Ticket Validation API
// Used by staff at door/bar to validate attendee QR tickets
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const STAFF_PIN = process.env.STAFF_PIN || '1234';
const TICKET_SECRET = process.env.TICKET_SECRET || process.env.NWC_URL || 'hdmp-default-secret';

// Verify HMAC signature for ticket data
function verifyTicketSignature(data, signature) {
  const payload = `${data.eventId}:${data.name}:${data.paymentHash}:${data.amount}:${data.timestamp}`;
  const expected = crypto.createHmac('sha256', TICKET_SECRET).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, pin, ticket } = req.body;

  // ── Action: verify-pin ──
  if (action === 'verify-pin') {
    if (!pin) {
      return res.status(400).json({ valid: false, error: 'PIN required' });
    }
    const valid = pin === STAFF_PIN;
    return res.status(200).json({ valid });
  }

  // ── Action: validate-ticket ──
  if (action === 'validate-ticket') {
    if (!ticket) {
      return res.status(400).json({ valid: false, error: 'Ticket data required' });
    }

    // Check required fields
    if (!ticket.eventId || !ticket.paymentHash) {
      return res.status(400).json({ valid: false, error: 'Missing ticket fields', details: 'eventId and paymentHash required' });
    }

    // If ticket has server signature, verify it
    if (ticket.signature) {
      const sigValid = verifyTicketSignature({
        eventId: ticket.eventId,
        name: ticket.name || 'Anónimo',
        paymentHash: ticket.paymentHash,
        amount: parseInt(ticket.amount, 10),
        timestamp: ticket.timestamp
      }, ticket.signature);

      return res.status(200).json({
        valid: sigValid,
        serverSigned: true,
        ticket: {
          eventId: ticket.eventId,
          name: ticket.name || 'Anónimo',
          amount: ticket.amount,
          paymentHash: ticket.paymentHash,
          code: ticket.code || null,
          timestamp: ticket.timestamp
        }
      });
    }

    // No server signature — ticket from pre-v3 or client-only mode
    // Still valid but flag as not server-verified
    return res.status(200).json({
      valid: true,
      serverSigned: false,
      warning: 'Ticket without server signature (pre-v3 or offline mode)',
      ticket: {
        eventId: ticket.eventId,
        name: ticket.name || 'Anónimo',
        amount: ticket.amount,
        paymentHash: ticket.paymentHash,
        code: ticket.code || null,
        timestamp: ticket.timestamp
      }
    });
  }

  return res.status(400).json({ error: 'Invalid action. Use "verify-pin" or "validate-ticket"' });
}
