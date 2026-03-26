// ══════════════════════════════════════════════════════════════
// HDMP v3.1 — Serverless NWC Backend (Vercel Function)
// NWC secret stays server-side, never exposed to the client
// v3.1: Added timeout wrapper to prevent Vercel 504 on slow relays
// ══════════════════════════════════════════════════════════════

const NWC_URL = process.env.NWC_URL;

import crypto from 'crypto';

// ── NIP-47 Constants ──
const NWC_METHODS = {
  MAKE_INVOICE: 'make_invoice',
  LOOKUP_INVOICE: 'lookup_invoice',
  GET_BALANCE: 'get_balance',
  PAY_INVOICE: 'pay_invoice',
  GET_INFO: 'get_info'
};

// ── Timeout wrapper (Vercel free tier = 10s, we use 8s to respond gracefully) ──
const NWC_OP_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms — relay may be slow`)), ms)
    )
  ]);
}

// Parse NWC URL into components
function parseNwcUrl(nwcUrl) {
  const url = new URL(nwcUrl.replace('nostr+walletconnect://', 'https://'));
  return {
    walletPubkey: url.hostname || url.pathname.replace('//', ''),
    relay: url.searchParams.get('relay'),
    secret: url.searchParams.get('secret'),
    lud16: url.searchParams.get('lud16')
  };
}

// ── CORS Headers ──
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!NWC_URL) {
    return res.status(500).json({ error: 'NWC_URL not configured' });
  }

  const { action, params } = req.body;

  if (!action || !NWC_METHODS[action.toUpperCase()]) {
    return res.status(400).json({ error: 'Invalid action', valid: Object.keys(NWC_METHODS) });
  }

  let client;
  try {
    // Dynamic import of @getalby/sdk
    const { nwc } = await import('@getalby/sdk');
    client = new nwc.NWCClient({ nostrWalletConnectUrl: NWC_URL });

    let result;

    switch (action) {
      case 'make_invoice':
        if (!params?.amount || !params?.description) {
          return res.status(400).json({ error: 'amount and description required' });
        }
        // Validate amount is positive integer
        const amount = parseInt(params.amount, 10);
        if (isNaN(amount) || amount <= 0 || amount > 10000000) {
          return res.status(400).json({ error: 'Invalid amount (must be 1-10000000 msats)' });
        }
        // Sanitize description (max 500 chars, strip control characters)
        const description = String(params.description).slice(0, 500).replace(/[\x00-\x1f\x7f]/g, '');
        if (!description.trim()) {
          return res.status(400).json({ error: 'Description cannot be empty' });
        }
        result = await withTimeout(
          client.makeInvoice({ amount, description }),
          NWC_OP_TIMEOUT_MS,
          'makeInvoice'
        );
        // Return normalized invoice data
        return res.status(200).json({
          invoice: result.paymentRequest || result.payment_request || result.invoice || result.bolt11 || '',
          payment_hash: result.paymentHash || result.payment_hash || '',
          amount: amount
        });

      case 'lookup_invoice':
        if (!params?.payment_hash) {
          return res.status(400).json({ error: 'payment_hash required' });
        }
        result = await withTimeout(
          client.lookupInvoice({ payment_hash: params.payment_hash }),
          NWC_OP_TIMEOUT_MS,
          'lookupInvoice'
        );
        // Unwrap NIP-47 response wrappers
        if (result?.result && typeof result.result === 'object') result = result.result;
        if (result?.response && typeof result.response === 'object') result = result.response;

        // Normalize and return
        const preimage = result?.preimage || result?.payment_preimage || null;
        const settledAt = (typeof result?.settled_at === 'number' && result.settled_at > 0) ? result.settled_at
          : (typeof result?.settledAt === 'number' && result.settledAt > 0) ? result.settledAt
          : null;
        const stateStr = (result?.state || result?.status || '').toString().toLowerCase();
        const isStateSettled = stateStr === 'settled' || stateStr === 'paid' || stateStr === 'complete' || stateStr === 'completed';
        const isPaid = (preimage && preimage.length >= 32) || settledAt || isStateSettled || result?.paid === true;

        // VULN-002: Include amount for client-side validation
        const invoiceAmount = result?.amount || result?.amount_msat || result?.amount_msats || null;

        return res.status(200).json({
          paid: isPaid,
          preimage: preimage || null,
          settled_at: settledAt || null,
          state: stateStr || 'pending',
          amount: invoiceAmount
        });

      case 'get_balance':
        result = await withTimeout(client.getBalance(), NWC_OP_TIMEOUT_MS, 'getBalance');
        return res.status(200).json({
          balance: result?.balance || 0
        });

      case 'get_info':
        result = await withTimeout(client.getInfo(), NWC_OP_TIMEOUT_MS, 'getInfo');
        return res.status(200).json({
          alias: result?.alias || 'HDMP Wallet',
          connected: true
        });

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('NWC API error:', err.message);
    // Always return valid JSON — prevents "not valid JSON" client error
    const isTimeout = err.message?.includes('timeout');
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? 'Relay lento — reintentá en unos segundos'
        : 'Payment processing failed. Please try again.',
      timeout: isTimeout
    });
  } finally {
    // Clean up WebSocket connection to prevent hanging
    try { if (client?.close) client.close(); } catch (_) {}
  }
}
