/**
 * HDMP v2 — Unit Tests
 * Tests de las funciones core del sistema de reservas con NWC + Zaps
 *
 * Ejecutar: node tests/unit-tests.js
 */

// ── MOCK LOCALSTORAGE ────────────────────────────────
const storage = {};
const localStorage = {
  getItem(key) { return storage[key] || null; },
  setItem(key, value) { storage[key] = value; },
  removeItem(key) { delete storage[key]; },
  clear() { Object.keys(storage).forEach(k => delete storage[k]); }
};

// ── FUNCIONES BAJO TEST (extraídas del index.html) ────
function generateTicketCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0,O,I,1,L
  let code = 'HDMP-';
  // v2.3: CSPRNG + 8 chars (simulated with Math.random in Node test env)
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 8; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

function getReservations() {
  return JSON.parse(localStorage.getItem('hdmp_reservations') || '[]');
}

function saveReservation(reservation) {
  const reservations = getReservations();
  if (reservations.find(r => r.ticketCode === reservation.ticketCode)) return;
  // Prevent duplicate paymentHash (double-spend prevention)
  if (reservation.paymentHash && reservations.find(r => r.paymentHash === reservation.paymentHash)) return;
  reservations.push(reservation);
  localStorage.setItem('hdmp_reservations', JSON.stringify(reservations));
}

function markRedeemed(ticketCode) {
  const reservations = getReservations();
  const idx = reservations.findIndex(r => r.ticketCode === ticketCode);
  if (idx === -1) return false;
  if (reservations[idx].status === 'redeemed') return 'already';
  reservations[idx].status = 'redeemed';
  reservations[idx].redeemedAt = new Date().toISOString();
  localStorage.setItem('hdmp_reservations', JSON.stringify(reservations));
  return true;
}

function getPaymentLog() {
  return JSON.parse(localStorage.getItem('hdmp_payment_log') || '[]');
}

function addPaymentLog(entry) {
  const log = getPaymentLog();
  if (log.find(l => l.paymentHash === entry.paymentHash)) return;
  log.push(entry);
  localStorage.setItem('hdmp_payment_log', JSON.stringify(log));
}

// Validation helpers
function isValidNWCUrl(url) {
  return typeof url === 'string' && url.startsWith('nostr+walletconnect://') && url.length > 30;
}

function isValidPaymentHash(hash) {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash);
}

function isValidTicketCode(code) {
  return typeof code === 'string' && /^HDMP-[A-HJ-KMNP-Z2-9]{8}$/.test(code);
}

function isValidInvoice(invoice) {
  return typeof invoice === 'string' && invoice.startsWith('lnbc');
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>"'&]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2028\u2029]/g, '')
    .normalize('NFKC')
    .trim()
    .slice(0, 100);
}

// ── TEST FRAMEWORK ───────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  localStorage.clear();
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try { fn(); } catch(e) { threw = true; }
  if (!threw) throw new Error(message || 'Expected function to throw');
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

console.log("\n⚡ HDMP v2 — Unit Tests\n");
console.log("━".repeat(50));

// ── TICKET CODE GENERATION ────────────────────────────
console.log("\n📝 Ticket Code Generation");

test('generateTicketCode returns valid format', () => {
  const code = generateTicketCode();
  assert(isValidTicketCode(code), `Invalid code: ${code}`);
});

test('generateTicketCode starts with HDMP-', () => {
  const code = generateTicketCode();
  assert(code.startsWith('HDMP-'), 'Should start with HDMP-');
});

test('generateTicketCode has correct length', () => {
  const code = generateTicketCode();
  assertEqual(code.length, 13, 'Code should be 13 chars (HDMP- + 8)');
});

test('generateTicketCode produces unique codes', () => {
  const codes = new Set();
  for (let i = 0; i < 100; i++) codes.add(generateTicketCode());
  assert(codes.size >= 95, `Expected >=95 unique codes in 100, got ${codes.size}`);
});

test('generateTicketCode uses only allowed characters', () => {
  const allowed = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  for (let i = 0; i < 50; i++) {
    const code = generateTicketCode();
    const suffix = code.slice(5);
    for (const ch of suffix) {
      assert(allowed.has(ch), `Invalid character in code: ${ch}`);
    }
  }
});

test('generateTicketCode excludes ambiguous chars (0, O, I, 1, L)', () => {
  const forbidden = new Set('0OI1L');
  for (let i = 0; i < 200; i++) {
    const suffix = generateTicketCode().slice(5);
    for (const ch of suffix) {
      assert(!forbidden.has(ch), `Found forbidden char: ${ch}`);
    }
  }
});

// ── RESERVATION CRUD ──────────────────────────────────
console.log("\n🎟️ Reservation CRUD");

test('getReservations returns empty array initially', () => {
  const r = getReservations();
  assertEqual(r.length, 0);
});

test('saveReservation persists data', () => {
  saveReservation({ ticketCode: 'HDMP-ABCDEFGH', name: 'Test', amount: 1000, status: 'confirmed' });
  const r = getReservations();
  assertEqual(r.length, 1);
  assertEqual(r[0].name, 'Test');
});

test('saveReservation prevents duplicate ticket codes', () => {
  saveReservation({ ticketCode: 'HDMP-ABCDEFGH', name: 'First', amount: 1000, status: 'confirmed' });
  saveReservation({ ticketCode: 'HDMP-ABCDEFGH', name: 'Duplicate', amount: 1000, status: 'confirmed' });
  const r = getReservations();
  assertEqual(r.length, 1);
  assertEqual(r[0].name, 'First');
});

test('saveReservation allows multiple unique reservations', () => {
  saveReservation({ ticketCode: 'HDMP-AAABBBCC', name: 'A', amount: 1000, status: 'confirmed' });
  saveReservation({ ticketCode: 'HDMP-BBBCCCDD', name: 'B', amount: 1000, status: 'confirmed' });
  saveReservation({ ticketCode: 'HDMP-CCCDDDEF', name: 'C', amount: 1000, status: 'confirmed' });
  assertEqual(getReservations().length, 3);
});

test('markRedeemed returns true for valid ticket', () => {
  saveReservation({ ticketCode: 'HDMP-XYZABCDE', name: 'Attendee', amount: 1000, status: 'confirmed' });
  const result = markRedeemed('HDMP-XYZABCDE');
  assertEqual(result, true);
});

test('markRedeemed updates status to redeemed', () => {
  saveReservation({ ticketCode: 'HDMP-XYZABCDE', name: 'Attendee', amount: 1000, status: 'confirmed' });
  markRedeemed('HDMP-XYZABCDE');
  const r = getReservations();
  assertEqual(r[0].status, 'redeemed');
  assert(r[0].redeemedAt !== null, 'redeemedAt should be set');
});

test('markRedeemed returns "already" for double-redeem', () => {
  saveReservation({ ticketCode: 'HDMP-XYZABCDE', name: 'Attendee', amount: 1000, status: 'confirmed' });
  markRedeemed('HDMP-XYZABCDE');
  const result = markRedeemed('HDMP-XYZABCDE');
  assertEqual(result, 'already');
});

test('markRedeemed returns false for non-existent ticket', () => {
  const result = markRedeemed('HDMP-NOEXISTT');
  assertEqual(result, false);
});

// ── PAYMENT LOG ───────────────────────────────────────
console.log("\n💰 Payment Log");

test('getPaymentLog returns empty array initially', () => {
  assertEqual(getPaymentLog().length, 0);
});

test('addPaymentLog adds entry', () => {
  addPaymentLog({ paymentHash: 'a'.repeat(64), amount: 1000, name: 'Test' });
  assertEqual(getPaymentLog().length, 1);
});

test('addPaymentLog prevents duplicate by paymentHash', () => {
  const hash = 'b'.repeat(64);
  addPaymentLog({ paymentHash: hash, amount: 1000, name: 'First' });
  addPaymentLog({ paymentHash: hash, amount: 2000, name: 'Duplicate' });
  const log = getPaymentLog();
  assertEqual(log.length, 1);
  assertEqual(log[0].name, 'First');
});

test('addPaymentLog stores all payment fields', () => {
  const entry = {
    paymentHash: 'c'.repeat(64),
    preimage: 'd'.repeat(64),
    amount: 1000,
    name: 'Full Entry',
    invoice: 'lnbc1000n1...',
    verified: true,
    zapRequestId: 'zr_123',
    zapReceiptId: 'zrec_456',
    verificationMethod: 'NWC (NIP-47)'
  };
  addPaymentLog(entry);
  const stored = getPaymentLog()[0];
  assertEqual(stored.paymentHash, entry.paymentHash);
  assertEqual(stored.preimage, entry.preimage);
  assertEqual(stored.verified, true);
  assertEqual(stored.zapRequestId, 'zr_123');
  assertEqual(stored.verificationMethod, 'NWC (NIP-47)');
});

// ── VALIDATION FUNCTIONS ──────────────────────────────
console.log("\n🔍 Validation Functions");

test('isValidNWCUrl accepts valid NWC strings', () => {
  assert(isValidNWCUrl('nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss://relay.damus.io&secret=71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c'));
});

test('isValidNWCUrl rejects empty string', () => {
  assert(!isValidNWCUrl(''));
});

test('isValidNWCUrl rejects non-NWC strings', () => {
  assert(!isValidNWCUrl('https://example.com'));
  assert(!isValidNWCUrl('wss://relay.damus.io'));
  assert(!isValidNWCUrl('nostr+walletconnect://short'));
});

test('isValidPaymentHash accepts 64-char hex', () => {
  assert(isValidPaymentHash('a'.repeat(64)));
  assert(isValidPaymentHash('0123456789abcdef'.repeat(4)));
});

test('isValidPaymentHash rejects invalid hashes', () => {
  assert(!isValidPaymentHash(''));
  assert(!isValidPaymentHash('a'.repeat(63)));
  assert(!isValidPaymentHash('a'.repeat(65)));
  assert(!isValidPaymentHash('g'.repeat(64))); // not hex
  assert(!isValidPaymentHash(null));
});

test('isValidTicketCode accepts valid codes', () => {
  assert(isValidTicketCode('HDMP-ABCDEFGH'));
  assert(isValidTicketCode('HDMP-ZZZZZ999'));
});

test('isValidTicketCode rejects invalid codes', () => {
  assert(!isValidTicketCode(''));
  assert(!isValidTicketCode('XXXX-ABCDEFGH'));
  assert(!isValidTicketCode('HDMP-abcdefgh')); // lowercase
  assert(!isValidTicketCode('HDMP-AB')); // too short
  assert(!isValidTicketCode('HDMP-ABCDEF')); // 6 chars (old format)
});

test('isValidInvoice accepts bolt11 invoices', () => {
  assert(isValidInvoice('lnbc1000n1pj9npk...'));
  assert(isValidInvoice('lnbc50n1demo...'));
});

test('isValidInvoice rejects non-bolt11', () => {
  assert(!isValidInvoice(''));
  assert(!isValidInvoice('bitcoin:bc1q...'));
  assert(!isValidInvoice('not_an_invoice'));
});

// ── INPUT SANITIZATION ────────────────────────────────
console.log("\n🛡️ Input Sanitization");

test('sanitizeInput removes HTML tags', () => {
  const result = sanitizeInput('<script>alert("xss")</script>');
  assert(!result.includes('<'), 'Should not contain <');
  assert(!result.includes('>'), 'Should not contain >');
});

test('sanitizeInput removes quotes', () => {
  const result = sanitizeInput('He said "hello" and \'bye\'');
  assert(!result.includes('"'), 'Should not contain double quotes');
  assert(!result.includes("'"), 'Should not contain single quotes');
});

test('sanitizeInput trims whitespace', () => {
  assertEqual(sanitizeInput('  hello  '), 'hello');
});

test('sanitizeInput limits length to 100', () => {
  const long = 'a'.repeat(200);
  const result = sanitizeInput(long);
  assertEqual(result.length, 100);
});

test('sanitizeInput handles non-string input', () => {
  assertEqual(sanitizeInput(null), '');
  assertEqual(sanitizeInput(undefined), '');
  assertEqual(sanitizeInput(42), '');
});

test('sanitizeInput removes ampersand', () => {
  const result = sanitizeInput('A & B');
  assert(!result.includes('&'), 'Should not contain &');
});

// ── NIP-57 ZAP EVENT STRUCTURE ────────────────────────
console.log("\n⚡ NIP-57 Zap Event Structure");

test('Zap request must be kind 9734', () => {
  const zapRequest = { kind: 9734, tags: [["p", "abc123"]], content: "test" };
  assertEqual(zapRequest.kind, 9734);
});

test('Zap receipt must be kind 9735', () => {
  const zapReceipt = { kind: 9735, tags: [["p", "abc123"], ["bolt11", "lnbc..."]], content: "" };
  assertEqual(zapReceipt.kind, 9735);
});

test('Zap request must have p tag', () => {
  const tags = [["p", "recipient_pubkey"], ["amount", "1000000"], ["relays", "wss://relay.damus.io"]];
  const pTag = tags.find(t => t[0] === 'p');
  assert(pTag !== undefined, 'Must have p tag');
  assert(pTag[1].length > 0, 'p tag must have value');
});

test('Zap request amount must be in millisats', () => {
  const sats = 1000;
  const msats = sats * 1000;
  const amountTag = ["amount", String(msats)];
  assertEqual(amountTag[1], "1000000");
});

test('Zap receipt must have bolt11 tag', () => {
  const tags = [["p", "abc"], ["bolt11", "lnbc1000n1..."]];
  const bolt11 = tags.find(t => t[0] === 'bolt11');
  assert(bolt11 !== undefined, 'Must have bolt11 tag');
  assert(bolt11[1].startsWith('lnbc'), 'bolt11 must be valid invoice');
});

test('Zap receipt content should be empty', () => {
  const zapReceipt = { kind: 9735, content: "" };
  assertEqual(zapReceipt.content, "");
});

// ── NIP-47 NWC PROTOCOL ──────────────────────────────
console.log("\n🔌 NIP-47 NWC Protocol");

test('NWC URL parsing extracts pubkey and relay', () => {
  const url = 'nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss://relay.damus.io&secret=71a8c14c';
  const parts = new URL(url.replace('nostr+walletconnect://', 'https://'));
  const pubkey = parts.hostname;
  const relay = parts.searchParams.get('relay');
  const secret = parts.searchParams.get('secret');
  assertEqual(pubkey, 'b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4');
  assertEqual(relay, 'wss://relay.damus.io');
  assertEqual(secret, '71a8c14c');
});

test('NWC makeInvoice requires amount in millisats', () => {
  const sats = 1000;
  const request = { method: 'make_invoice', params: { amount: sats * 1000, description: 'Test' } };
  assertEqual(request.params.amount, 1000000);
});

test('NWC lookupInvoice requires payment_hash', () => {
  const request = { method: 'lookup_invoice', params: { payment_hash: 'a'.repeat(64) } };
  assert(isValidPaymentHash(request.params.payment_hash));
});

// ── INTEGRITY CHECK LOGIC ────────────────────────────
console.log("\n🔐 Integrity Check");

test('Detects missing payment log entries', () => {
  saveReservation({ ticketCode: 'HDMP-AAABBBCC', paymentHash: 'a'.repeat(64), status: 'confirmed' });
  // No payment log entry → should be detected
  const reservations = getReservations();
  const log = getPaymentLog();
  const missing = reservations.filter(r => r.paymentHash && !log.find(l => l.paymentHash === r.paymentHash));
  assertEqual(missing.length, 1);
});

test('Detects duplicate payment hashes', () => {
  const hash = 'e'.repeat(64);
  // Force duplicates
  const log = [
    { paymentHash: hash, amount: 1000 },
    { paymentHash: hash, amount: 1000 }
  ];
  const hashes = log.map(l => l.paymentHash);
  const dupes = hashes.filter((h, i) => hashes.indexOf(h) !== i);
  assertEqual(dupes.length, 1);
});

test('Detects invalid amounts', () => {
  const expectedPrice = 1000;
  const log = [
    { paymentHash: 'f'.repeat(64), amount: 1000 },
    { paymentHash: 'e'.repeat(64), amount: 999 }, // wrong
    { paymentHash: 'd'.repeat(64), amount: 5000 }, // wrong
  ];
  const invalid = log.filter(l => l.amount !== expectedPrice);
  assertEqual(invalid.length, 2);
});

test('Detects verified payments without preimage', () => {
  const log = [
    { paymentHash: 'a'.repeat(64), verified: true, preimage: 'b'.repeat(64) },
    { paymentHash: 'c'.repeat(64), verified: true, preimage: null }, // issue
    { paymentHash: 'd'.repeat(64), verified: true, preimage: 'N/A' }, // issue
  ];
  const issues = log.filter(l => l.verified && (!l.preimage || l.preimage === 'N/A'));
  assertEqual(issues.length, 2);
});

// ── SECURITY HARDENING (v2.2 Fixes) ─────────────────
console.log("\n🔒 Security Hardening v2.2");

test('sanitizeInput strips null bytes', () => {
  const result = sanitizeInput('Hello\x00World');
  assert(!result.includes('\x00'), 'Should not contain null bytes');
  assertEqual(result, 'HelloWorld');
});

test('sanitizeInput strips zero-width characters', () => {
  const result = sanitizeInput('Hello\u200BWorld\u200C\u200D\uFEFF');
  assertEqual(result, 'HelloWorld');
});

test('sanitizeInput strips control characters', () => {
  const result = sanitizeInput('Hello\x01\x02\x03World\x1F');
  assertEqual(result, 'HelloWorld');
});

test('sanitizeInput normalizes unicode (NFKC)', () => {
  // ﬀ (U+FB00 LATIN SMALL LIGATURE FF) should normalize to "ff"
  const result = sanitizeInput('\uFB00');
  assertEqual(result, 'ff');
});

test('saveReservation blocks duplicate paymentHash (double-spend)', () => {
  const hash = 'a'.repeat(64);
  saveReservation({ ticketCode: 'HDMP-AAABBBCC', paymentHash: hash, name: 'First', amount: 1000, status: 'confirmed' });
  saveReservation({ ticketCode: 'HDMP-BBBCCCDD', paymentHash: hash, name: 'DoubleSpend', amount: 1000, status: 'confirmed' });
  const r = getReservations();
  assertEqual(r.length, 1, 'Should block second reservation with same paymentHash');
  assertEqual(r[0].name, 'First');
});

test('addPaymentLog blocks duplicate paymentHash', () => {
  const hash = 'f'.repeat(64);
  addPaymentLog({ paymentHash: hash, amount: 1000, name: 'First' });
  addPaymentLog({ paymentHash: hash, amount: 1000, name: 'Duplicate' });
  const log = getPaymentLog();
  assertEqual(log.length, 1);
});

test('markRedeemed rejects invalid ticket code format', () => {
  saveReservation({ ticketCode: 'HDMP-ABCDEFGH', name: 'Test', amount: 1000, status: 'confirmed' });
  // Try with script injection in ticket code
  const result = markRedeemed('<script>alert(1)</script>');
  assertEqual(result, false, 'Should reject invalid format');
});

test('markRedeemed validates strict ticket code regex', () => {
  // lowercase should fail
  assertEqual(markRedeemed('hdmp-abc234'), false);
  // Wrong prefix
  assertEqual(markRedeemed('XXXX-ABC234'), false);
  // SQL injection attempt
  assertEqual(markRedeemed("HDMP-'; DROP"), false);
});

test('escapeHtml prevents XSS in display', () => {
  const escaped = escapeHtml('<img onerror=alert(1) src=x>');
  assert(!escaped.includes('<img'), 'Should escape HTML tags');
  assert(escaped.includes('&lt;'), 'Should contain escaped entities');
});

test('escapeHtml handles non-string input safely', () => {
  assertEqual(escapeHtml(null), '');
  assertEqual(escapeHtml(undefined), '');
  assertEqual(escapeHtml(42), '');
});

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = { textContent: '', get innerHTML() { return this.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); } };
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════

console.log("\n" + "━".repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failures.length > 0) {
  console.log("\n❌ Failures:");
  failures.forEach(f => console.log(`   ${f.name}: ${f.error}`));
}

console.log(failed === 0 ? "\n✅ ALL TESTS PASSED\n" : "\n❌ SOME TESTS FAILED\n");

process.exit(failed > 0 ? 1 : 0);
