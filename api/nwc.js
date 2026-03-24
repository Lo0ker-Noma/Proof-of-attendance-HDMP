// ══════════════════════════════════════════════════════════════
// HDMP v3.0 — Serverless NWC Backend (Vercel Edge Function)
// NWC secret stays server-side, never exposed to the client
// ══════════════════════════════════════════════════════════════

const NWC_URL = process.env.NWC_URL;

// In-memory relay + NWC via raw Nostr protocol
// Since we can't use the full @getalby/sdk in serverless (WebSocket deps),
// we proxy requests through a lightweight NIP-47 implementation

import crypto from 'crypto';

// ── NIP-47 Constants ──
const NWC_METHODS = {
  MAKE_INVOICE: 'make_invoice',
  LOOKUP_INVOICE: 'lookup_invoice',
  GET_BALANCE: 'get_balance',
  PAY_INVOICE: 'pay_invoice',
  GET_INFO: 'get_info'
};

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

  try {
    // Dynamic import of @getalby/sdk
    const { nwc } = await import('@getalby/sdk');
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: NWC_URL });

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
        result = await client.makeInvoice({
          amount: amount,
          description: params.description
        });
        // Return normalized invoice data
        res.status(200).json({
          invoice: result.paymentRequest || result.payment_request || result.invoice || result.bolt11 || '',
          payment_hash: result.paymentHash || result.payment_hash || '',
          amount: amount
        });
        break;

      case 'lookup_invoice':
        if (!params?.payment_hash) {
          return res.status(400).json({ error: 'payment_hash required' });
        }
        result = await client.lookupInvoice({
          payment_hash: params.payment_hash
        });
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

        res.status(200).json({
          paid: isPaid,
          preimage: preimage || null,
          settled_at: settledAt || null,
          state: stateStr || 'pending',
          amount: invoiceAmount
        });
        break;

      case 'get_balance':
        result = await client.getBalance();
        res.status(200).json({
          balance: result?.balance || 0
        });
        break;

      case 'get_info':
        result = await client.getInfo();
        res.status(200).json({
          alias: result?.alias || 'HDMP Wallet',
          connected: true
        });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('NWC API error:', err.message);
    res.status(500).json({ error: err.message || 'NWC request failed' });
  }
}
