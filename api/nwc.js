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

  // Extract payment hash from bolt11 using @getalby/lightning-tools or manual decode
  let paymentHash = invoiceRes.payment_hash || invoiceRes.paymentHash || '';
  if (!paymentHash) {
    try {
      paymentHash = extractPaymentHashFromBolt11(bolt11);
      console.log('Extracted payment_hash from bolt11:', paymentHash.slice(0, 16) + '...');
    } catch (e) {
      console.warn('Could not extract payment_hash from bolt11:', e.message);
    }
  }

  // LUD-09: capture verify URL for payment verification without relay
  const verifyUrl = invoiceRes.verify || '';
  if (verifyUrl) {
    console.log('LNURL verify URL available:', verifyUrl.slice(0, 60) + '...');
  }

  return {
    invoice: bolt11,
    payment_hash: paymentHash,
    verify_url: verifyUrl,
    via: 'lnurl'
  };
}

// ── Extract payment hash from bolt11 invoice (bech32 decode) ──
// bolt11 format: lnbc<amount><multiplier>1<bech32data><signature>
// The payment hash is the first tagged field (tag 'p' = 1, 52 5-bit words = 32 bytes)
function extractPaymentHashFromBolt11(bolt11) {
  const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  // Find the separator '1' (last occurrence before data)
  const lower = bolt11.toLowerCase();
  const sepIdx = lower.lastIndexOf('1');
  if (sepIdx < 0) throw new Error('No bech32 separator');

  const dataStr = lower.slice(sepIdx + 1);
  // Remove checksum (6 chars) and signature (104 chars at end)
  // Signature is 520 bits = 104 bech32 chars, plus 6 checksum
  const withoutSigAndChecksum = dataStr.slice(0, dataStr.length - 110);

  // Convert bech32 chars to 5-bit values
  const data5bit = [];
  for (const ch of withoutSigAndChecksum) {
    const idx = BECH32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid bech32 char: ${ch}`);
    data5bit.push(idx);
  }

  // Skip timestamp (first 7 x 5-bit words = 35 bits)
  let pos = 7;

  // Parse tagged fields until we find 'p' (payment hash)
  while (pos < data5bit.length) {
    if (pos + 3 > data5bit.length) break;
    const tag = data5bit[pos]; // 5-bit tag
    pos++;
    // Data length: next 2 x 5-bit words (10 bits)
    const dataLen = (data5bit[pos] << 5) | data5bit[pos + 1];
    pos += 2;

    if (pos + dataLen > data5bit.length) break;

    if (tag === 1) { // tag 'p' = payment hash (value 1 in 5-bit)
      // Convert 5-bit words to bytes (8-bit)
      const words = data5bit.slice(pos, pos + dataLen);
      const bytes = convert5to8(words);
      // Payment hash is 32 bytes = 64 hex chars
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    pos += dataLen;
  }

  throw new Error('Payment hash tag not found in bolt11');
}

// Convert array of 5-bit values to 8-bit bytes
function convert5to8(data5) {
  let acc = 0;
  let bits = 0;
  const result = [];
  for (const val of data5) {
    acc = (acc << 5) | val;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }
  return result;
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
                verify_url: lnurlResult.verify_url || '',
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

        // v3.3: Try NWC first, fallback to LNURL verify URL, then LNURL-pay verify
        let lookupResult = null;
        let lookupVia = 'nwc';

        // Attempt 1: NWC relay
        try {
          result = await withTimeout(
            client.lookupInvoice({ payment_hash: params.payment_hash }),
            NWC_OP_TIMEOUT_MS,
            'lookupInvoice'
          );
          // Unwrap NIP-47 response wrappers
          if (result?.result && typeof result.result === 'object') result = result.result;
          if (result?.response && typeof result.response === 'object') result = result.response;
          lookupResult = result;
          lookupVia = 'nwc';
        } catch (nwcErr) {
          console.warn('NWC lookupInvoice failed:', nwcErr.message);

          // Attempt 2: LNURL verify URL (LUD-09) — client passes it from make_invoice response
          if (params.verify_url) {
            try {
              console.log('Trying LNURL verify URL:', params.verify_url.slice(0, 60));
              const verifyRes = await withTimeout(
                fetch(params.verify_url).then(r => r.json()),
                LNURL_TIMEOUT_MS,
                'LNURL-verify'
              );
              console.log('LNURL verify response:', JSON.stringify(verifyRes));
              if (verifyRes && (verifyRes.settled !== undefined || verifyRes.status)) {
                lookupResult = {
                  preimage: verifyRes.preimage || null,
                  settled_at: verifyRes.settled ? Math.floor(Date.now() / 1000) : null,
                  state: verifyRes.settled ? 'settled' : 'pending',
                  paid: verifyRes.settled === true,
                  amount: verifyRes.amount || null
                };
                lookupVia = 'lnurl-verify';
              }
            } catch (verifyErr) {
              console.warn('LNURL verify URL failed:', verifyErr.message);
            }
          }

          // Attempt 3: Construct LNURL verify URL from lud16 + payment_hash
          if (!lookupResult && nwcParts.lud16) {
            try {
              const [user, domain] = nwcParts.lud16.split('@');
              const constructedVerifyUrl = `https://${domain}/.well-known/lnurlp/${user}/verify/${params.payment_hash}`;
              console.log('Trying constructed LNURL verify:', constructedVerifyUrl.slice(0, 80));
              const verifyRes = await withTimeout(
                fetch(constructedVerifyUrl).then(r => r.json()),
                LNURL_TIMEOUT_MS,
                'LNURL-verify-constructed'
              );
              console.log('Constructed verify response:', JSON.stringify(verifyRes));
              if (verifyRes && verifyRes.status !== 'ERROR' && (verifyRes.settled !== undefined || verifyRes.pr)) {
                lookupResult = {
                  preimage: verifyRes.preimage || null,
                  settled_at: verifyRes.settled ? Math.floor(Date.now() / 1000) : null,
                  state: verifyRes.settled ? 'settled' : 'pending',
                  paid: verifyRes.settled === true,
                  amount: verifyRes.amount || null
                };
                lookupVia = 'lnurl-verify-constructed';
              }
            } catch (constructedErr) {
              console.warn('Constructed LNURL verify failed:', constructedErr.message);
            }
          }

          // If all fallbacks failed, throw the original error
          if (!lookupResult) throw nwcErr;
        }

        const preimage = lookupResult?.preimage || lookupResult?.payment_preimage || null;
        const settledAt = (typeof lookupResult?.settled_at === 'number' && lookupResult.settled_at > 0) ? lookupResult.settled_at
          : (typeof lookupResult?.settledAt === 'number' && lookupResult.settledAt > 0) ? lookupResult.settledAt
          : null;
        const stateStr = (lookupResult?.state || lookupResult?.status || '').toString().toLowerCase();
        const isStateSettled = stateStr === 'settled' || stateStr === 'paid' || stateStr === 'complete' || stateStr === 'completed';
        const isPaid = (preimage && preimage.length >= 32) || settledAt || isStateSettled || lookupResult?.paid === true;
        const invoiceAmount = lookupResult?.amount || lookupResult?.amount_msat || lookupResult?.amount_msats || null;

        return res.status(200).json({
          paid: isPaid,
          preimage: preimage || null,
          settled_at: settledAt || null,
          state: stateStr || 'pending',
          amount: invoiceAmount,
          via: lookupVia
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
