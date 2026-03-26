// ══════════════════════════════════════════════════════════════
// HDMP v3.2 — Serverless NWC Backend (Vercel Function)
// NWC secret stays server-side, never exposed to the client
// v3.1: Added timeout wrapper to prevent Vercel 504 on slow relays
// v3.2: LNURL fallback — when NWC relay is slow, use Lightning Address
//       (HTTP-only, no WebSocket needed, much faster)
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

// ── Timeout wrapper (Vercel free tier = 10s) ──
const NWC_OP_TIMEOUT_MS = 5000;  // 5s for NWC (leaves room for LNURL fallback)
const LNURL_TIMEOUT_MS = 4000;   // 4s for LNURL fallback

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
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

// ── LNURL: Create invoice via Lightning Address (HTTP only, no WebSocket) ──
async function makeInvoiceViaLNURL(lud16, amountMsats, description) {
  // lud16 format: user@domain → https://domain/.well-known/lnurlp/user
  const [user, domain] = lud16.split('@');
  if (!user || !domain) throw new Error('Invalid lud16 format');

  const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${user}`;
  console.log('LNURL fallback: fetching', lnurlpUrl);

  // Step 1: Get LNURL-pay params
  const paramsRes = await withTimeout(
    fetch(lnurlpUrl).then(r => r.json()),
    LNURL_TIMEOUT_MS,
    'LNURL-params'
  );

  if (paramsRes.status === 'ERROR') {
    throw new Error(`LNURL error: ${paramsRes.reason || 'unknown'}`);
  }

  const { callback, minSendable, maxSendable } = paramsRes;
  if (!callback) throw new Error('LNURL: no callback URL');

  // Validate amount is within range
  if (amountMsats < (minSendable || 0) || amountMsats > (maxSendable || Infinity)) {
    throw new Error(`LNURL: amount ${amountMsats} out of range [${minSendable}-${maxSendable}]`);
  }

  // Step 2: Request invoice from callback
  const sep = callback.includes('?') ? '&' : '?';
  const invoiceUrl = `${callback}${sep}amount=${amountMsats}&comment=${encodeURIComponent(description.slice(0, 144))}`;
  console.log('LNURL fallback: requesting invoice');

  const invoiceRes = await withTimeout(
    fetch(invoiceUrl).then(r => r.json()),
    LNURL_TIMEOUT_MS,
    'LNURL-invoice'
  );

  if (invoiceRes.status === 'ERROR') {
    throw new Error(`LNURL invoice error: ${invoiceRes.reason || 'unknown'}`);
  }

  const bolt11 = invoiceRes.pr;
  if (!bolt11) throw new Error('LNURL: no invoice returned');

  // Extract payment hash from bolt11 (it's after lnbc and amount prefix)
  // We'll let the client handle payment hash extraction if needed
  return {
    invoice: bolt11,
    payment_hash: invoiceRes.payment_hash || invoiceRes.paymentHash || '',
    via: 'lnurl'
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

  const nwcParts = parseNwcUrl(NWC_URL);

  let client;
  try {
    // Dynamic import of @getalby/sdk
    const { nwc } = await import('@getalby/sdk');
    client = new nwc.NWCClient({ nostrWalletConnectUrl: NWC_URL });

    let result;

    switch (action) {
      case 'make_invoice': {
        if (!params?.amount || !params?.description) {
          return res.status(400).json({ error: 'amount and description required' });
        }
        const amount = parseInt(params.amount, 10);
        if (isNaN(amount) || amount <= 0 || amount > 10000000) {
          return res.status(400).json({ error: 'Invalid amount (must be 1-10000000 msats)' });
        }
        const description = String(params.description).slice(0, 500).replace(/[\x00-\x1f\x7f]/g, '');
        if (!description.trim()) {
          return res.status(400).json({ error: 'Description cannot be empty' });
        }

        // Try NWC first, fall back to LNURL if relay is slow
        try {
          result = await withTimeout(
            client.makeInvoice({ amount, description }),
            NWC_OP_TIMEOUT_MS,
            'makeInvoice'
          );
          return res.status(200).json({
            invoice: result.paymentRequest || result.payment_request || result.invoice || result.bolt11 || '',
            payment_hash: result.paymentHash || result.payment_hash || '',
            amount: amount,
            via: 'nwc'
          });
        } catch (nwcErr) {
          console.warn('NWC makeInvoice failed, trying LNURL fallback:', nwcErr.message);

          // LNURL fallback using Lightning Address from NWC URL
          if (nwcParts.lud16) {
            try {
              const lnurlResult = await makeInvoiceViaLNURL(nwcParts.lud16, amount, description);
              console.log('LNURL fallback success!');
              return res.status(200).json({
                invoice: lnurlResult.invoice,
                payment_hash: lnurlResult.payment_hash || '',
                amount: amount,
                via: 'lnurl'
              });
            } catch (lnurlErr) {
              console.error('LNURL fallback also failed:', lnurlErr.message);
              throw new Error(`NWC: ${nwcErr.message} | LNURL: ${lnurlErr.message}`);
            }
          }
          throw nwcErr; // No LNURL available, propagate NWC error
        }
      }

      case 'lookup_invoice': {
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

        const preimage = result?.preimage || result?.payment_preimage || null;
        const settledAt = (typeof result?.settled_at === 'number' && result.settled_at > 0) ? result.settled_at
          : (typeof result?.settledAt === 'number' && result.settledAt > 0) ? result.settledAt
          : null;
        const stateStr = (result?.state || result?.status || '').toString().toLowerCase();
        const isStateSettled = stateStr === 'settled' || stateStr === 'paid' || stateStr === 'complete' || stateStr === 'completed';
        const isPaid = (preimage && preimage.length >= 32) || settledAt || isStateSettled || result?.paid === true;
        const invoiceAmount = result?.amount || result?.amount_msat || result?.amount_msats || null;

        return res.status(200).json({
          paid: isPaid,
          preimage: preimage || null,
          settled_at: settledAt || null,
          state: stateStr || 'pending',
          amount: invoiceAmount
        });
      }

      case 'get_balance':
        result = await withTimeout(client.getBalance(), NWC_OP_TIMEOUT_MS, 'getBalance');
        return res.status(200).json({ balance: result?.balance || 0 });

      case 'get_info':
        // Try NWC first, return basic info on timeout (wallet still works for invoicing)
        try {
          result = await withTimeout(client.getInfo(), NWC_OP_TIMEOUT_MS, 'getInfo');
          return res.status(200).json({
            alias: result?.alias || 'HDMP Wallet',
            connected: true,
            lnurl: !!nwcParts.lud16
          });
        } catch (infoErr) {
          // Relay slow but LNURL available = wallet is usable
          if (nwcParts.lud16) {
            return res.status(200).json({
              alias: 'La Crypta ⚡ (LNURL)',
              connected: true,
              lnurl: true,
              relay_slow: true
            });
          }
          throw infoErr;
        }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('NWC API error:', err.message);
    const isTimeout = err.message?.includes('timeout');
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? 'Relay lento — reintentá en unos segundos'
        : 'Payment processing failed. Please try again.',
      timeout: isTimeout
    });
  } finally {
    try { if (client?.close) client.close(); } catch (_) {}
  }
}
