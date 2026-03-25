// ══════════════════════════════════════════════════════════════
// HDMP v3.0 — Staff PIN Verification & Ticket Validation API
// Used by staff at door/bar to validate attendee QR tickets
// Security: rate limiting, timing-safe comparison, HMAC-SHA256
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto';

// Fail closed: require STAFF_PIN in production
const STAFF_PIN = process.env.STAFF_PIN;
if (!STAFF_PIN) {
  console.warn('⚠️ STAFF_PIN not set — staff access will be denied');
}
const TICKET_SECRET = process.env.TICKET_SECRET || process.env.NWC_URL || 'hdmp-default-secret';

// ── Rate limiting (in-memory, per Vercel instance) ──
const pinAttempts = {}; // { ip: [{ timestamp }] }
const MAX_PIN_ATTEMPTS = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  if (!pinAttempts[ip]) pinAttempts[ip] = [];
  // Clean expired attempts
  pinAttempts[ip] = pinAttempts[ip].filter(a => now - a.timestamp < PIN_WINDOW_MS);
  return pinAttempts[ip].length < MAX_PIN_ATTEMPTS;
}

function recordAttempt(ip) {
  if (!pinAttempts[ip]) pinAttempts[ip] = [];
  pinAttempts[ip].push({ timestamp: Date.now() });
}

// ── Timing-safe PIN comparison ──
function verifyPin(input) {
  if (!STAFF_PIN) return false;
  try {
    const inputBuf = Buffer.from(String(input).padEnd(64, '\0'));
    const pinBuf = Buffer.from(String(STAFF_PIN).padEnd(64, '\0'));
    return crypto.timingSafeEqual(inputBuf, pinBuf);
  } catch {
    return false;
  }
}

// ── Verify HMAC signature for ticket data ──
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
    if (!pin || typeof pin !== 'string' || pin.length > 10) {
      return res.status(400).json({ valid: false, error: 'Invalid PIN format' });
    }

    // Rate limiting
    const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ valid: false, error: 'Demasiados intentos. Esperá 15 minutos.' });
    }

    recordAttempt(ip);
    const valid = verifyPin(pin);

    return res.status(200).json({ valid });
  }

  // ── Action: validate-ticket ──
  if (action === 'validate-ticket') {
    if (!ticket) {
      return res.status(400).json({ valid: false, error: 'Ticket data required' });
    }

    // Check required fields
    if (!ticket.eventId || !ticket.paymentHash) {
      return res.status(400).json({ valid: false, error: 'Missing ticket fields' });
    }

    // Validate paymentHash format (hex, 64 chars)
    if (!/^[a-f0-9]{64}$/i.test(ticket.paymentHash)) {
      return res.status(400).json({ valid: false, error: 'Invalid paymentHash format' });
    }

    // Require server signature — reject unsigned tickets (prevent localStorage forgery)
    if (!ticket.signature) {
      return res.status(200).json({
        valid: false,
        serverSigned: false,
        error: 'Ticket sin firma servidor — no se puede verificar autenticidad'
      });
    }

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
      ticket: sigValid ? {
        eventId: ticket.eventId,
        name: ticket.name || 'Anónimo',
        amount: ticket.amount,
        paymentHash: ticket.paymentHash,
        code: ticket.code || null,
        timestamp: ticket.timestamp
      } : null
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
