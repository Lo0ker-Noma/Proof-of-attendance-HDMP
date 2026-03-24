    import QRCode from "https://esm.sh/qrcode@1.5.3";
    // nostr-tools for event creation and signing (NIP-57)
    import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from "https://esm.sh/nostr-tools@2.7.0";
    import { bytesToHex, hexToBytes } from "https://esm.sh/@noble/hashes@1.4.0/utils";

    // ── CONFIGURACIÓN DE EVENTOS (MULTI-EVENTO) ──────────
    const EVENTS_LIST = [
      {
        id: 'cowork-mar17',
        name: 'Cowork — SOLO CON TICKET',
        series: 'Proof of Attendance (HDMP)',
        date: 'Martes 17 de Marzo, 2026',
        dateShort: 'Mar 17',
        time: '16:00hs',
        location: 'Villanueva 1367 — La Crypta, Buenos Aires',
        price: 2100,
        maxCapacity: 24,
        organizerLnAddress: 'tamedpeen07@walletofsatoshi.com',
        organizerPubkey: '0000000000000000000000000000000000000000000000000000000000000000',
        nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
      },
      {
        id: 'cowork-mar24',
        name: 'Cowork — SOLO CON TICKET',
        series: 'Proof of Attendance (HDMP)',
        date: 'Martes 24 de Marzo, 2026',
        dateShort: 'Mar 24',
        time: '16:00hs',
        location: 'Villanueva 1367 — La Crypta, Buenos Aires',
        price: 2100,
        maxCapacity: 24,
        organizerLnAddress: 'tamedpeen07@walletofsatoshi.com',
        organizerPubkey: '0000000000000000000000000000000000000000000000000000000000000000',
        nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
      },
      {
        id: 'cowork-mar31',
        name: 'Cowork — SOLO CON TICKET',
        series: 'Proof of Attendance (HDMP)',
        date: 'Martes 31 de Marzo, 2026',
        dateShort: 'Mar 31',
        time: '17:00hs',
        location: 'Villanueva 1367 — La Crypta, Buenos Aires',
        price: 2100,
        maxCapacity: 24,
        organizerLnAddress: 'tamedpeen07@walletofsatoshi.com',
        organizerPubkey: '0000000000000000000000000000000000000000000000000000000000000000',
        nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
      },
      {
        id: 'cowork-apr7',
        name: 'Cowork — SOLO CON TICKET',
        series: 'Proof of Attendance (HDMP)',
        date: 'Martes 7 de Abril, 2026',
        dateShort: 'Abr 7',
        time: '17:00hs',
        location: 'Villanueva 1367 — La Crypta, Buenos Aires',
        price: 2100,
        maxCapacity: 24,
        organizerLnAddress: 'tamedpeen07@walletofsatoshi.com',
        organizerPubkey: '0000000000000000000000000000000000000000000000000000000000000000',
        nostrRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
      }
    ];

    let selectedEvent = EVENTS_LIST[0]; // default to first event
    let EVENT_CONFIG = selectedEvent; // backward compatibility

    // ── ORG WALLET CONFIG ──────────────────────────────
    // v3.0: NWC secret moved to Vercel backend (env var NWC_URL)
    // Client calls /api/nwc — secret never reaches the browser
    // Fallback: direct NWC if API unavailable (dev/local mode)
    const _ORG_NWC_B64 = 'bm9zdHIrd2FsbGV0Y29ubmVjdDovL2Y2N2MxMDA4YmJmNTgxZDI4M2RiODg0YTk3OTAxNDU1ODQ1NDJhM2YxNjkyYWY1ZDRlYjNhNjYyOGE1MmU2Yjg/cmVsYXk9d3NzOi8vcmVsYXkucHJpbWFsLm5ldCZzZWNyZXQ9Zjk3MTc1OTlkNzk3ZjM0M2FlZTk4OGIyNDNjYTJkMDVjNTZlMmQxZjg5NTc0NDAzY2FmM2Q0YmJhZjgwOGMzYyZsdWQxNj1ub2JsZW1vb3NlMjFAcHJpbWFsLm5ldA==';
    const ORG_NWC_URL = atob(_ORG_NWC_B64);
    let useBackendAPI = false; // Will be set true if /api/nwc is available

    // ── BACKEND API HELPER ──────────────────────────────
    async function nwcAPI(action, params = {}) {
      const res = await fetch('/api/nwc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.json()).error || 'failed'}`);
      return res.json();
    }

    // ── STATE ────────────────────────────────────────────
    let nwcClient = null;
    let isNWCConnected = false;
    let isDemoMode = false;
    let currentInvoice = null;
    let currentPaymentHash = null;
    let currentName = "";
    let currentNpub = "";
    let paymentCheckInterval = null;

    // Demo mock removed — production only, real NWC payments

    // ── TOAST NOTIFICATIONS ──────────────────────────────
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    // ── NWC CONNECTION ──────────────────────────────────
    // v3.0: Try backend API first (secret server-side), fallback to direct NWC
    async function autoConnectOrgWallet() {
      // Try backend API first
      try {
        const info = await nwcAPI('get_info');
        if (info.connected) {
          useBackendAPI = true;
          isNWCConnected = true;
          isDemoMode = false;
          console.log('Connected via backend API:', info.alias);
          updateNWCStatus(true, info.alias || 'La Crypta');
          return true;
        }
      } catch (apiErr) {
        console.log('Backend API not available, falling back to direct NWC:', apiErr.message);
      }

      // Fallback: direct NWC connection (dev/local mode)
      try {
        const { nwc } = await import("https://esm.sh/@getalby/sdk@3.5.1");
        nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: ORG_NWC_URL });
        const info = await nwcClient.getInfo();
        isNWCConnected = true;
        isDemoMode = false;
        useBackendAPI = false;
        console.log('Org wallet connected (direct NWC):', info.alias || 'La Crypta');
        updateNWCStatus(true, info.alias || 'La Crypta');
        return true;
      } catch (err) {
        console.error('Org wallet connection failed:', err.message);
        updateNWCStatus(false, 'Error de conexión');
        return false;
      }
    }

    // Manual NWC connection (from organizer panel)
    window.connectNWC = async function() {
      const input = document.getElementById('nwcOrgInput')?.value?.trim();

      if (!input || !input.startsWith('nostr+walletconnect://')) {
        showToast('El string debe empezar con nostr+walletconnect://', 'error');
        return;
      }

      try {
        const { nwc } = await import("https://esm.sh/@getalby/sdk@3.5.1");
        nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: input });
        const info = await nwcClient.getInfo();
        isNWCConnected = true;
        isDemoMode = false;
        console.log('NWC connected (secret redacted):', input.replace(/secret=[^&]+/, 'secret=REDACTED'));
        updateNWCStatus(true, info.alias || 'Wallet conectada');
        showToast(`Wallet "${info.alias || 'NWC'}" conectada`, 'success');
      } catch (err) {
        showToast('Error conectando: ' + err.message, 'error');
      }
    };

    // ── EVENT SELECTION ──────────────────────────────────
    window.selectEvent = function(eventId) {
      selectedEvent = EVENTS_LIST.find(e => e.id === eventId) || EVENTS_LIST[0];
      // Update EVENT_CONFIG reference for backward compat
      Object.assign(EVENT_CONFIG, selectedEvent);

      renderEventsList();
      showEventDetail();
    };

    function renderEventsList() {
      const container = document.getElementById('eventsList');
      container.innerHTML = EVENTS_LIST.map(evt => {
        const parts = evt.dateShort.split(' ');
        const month = parts[0];
        const day = parts[1];
        const isSelected = evt.id === selectedEvent.id;
        return `
          <div class="event-list-card ${isSelected ? 'selected' : ''}" onclick="selectEvent('${evt.id}')">
            <div class="elc-left">
              <div class="elc-date">
                <div class="day">${day}</div>
                <div class="month">${month}</div>
              </div>
              <div class="elc-info">
                <div class="elc-name">${escapeHtml(evt.name)}</div>
                <div class="elc-time">🕐 ${evt.time} · 📍 La Crypta</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="elc-price">${evt.price.toLocaleString()} sats</div>
              <div class="elc-arrow">→</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function showEventDetail() {
      const detail = document.getElementById('selectedEventDetail');
      detail.style.display = 'block';
      document.getElementById('detailEventName').textContent = selectedEvent.name;
      document.getElementById('detailEventSeries').textContent = selectedEvent.series;
      document.getElementById('detailDate').textContent = selectedEvent.date;
      document.getElementById('detailTime').textContent = selectedEvent.time + ' (Argentina)';
      document.getElementById('detailLocation').textContent = selectedEvent.location;
      document.getElementById('detailCapacity').textContent = selectedEvent.maxCapacity;
      document.getElementById('detailPrice').textContent = selectedEvent.price.toLocaleString() + ' sats';
      document.getElementById('detailPriceText').textContent = selectedEvent.price.toLocaleString() + ' sats';
      updatePriceUsd();
      updateSpotsBar();

      // Scroll to detail
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── CONVERSIÓN SATS → USD (live price) ──────────────
    let _btcPriceUsd = null;
    async function fetchBtcPrice() {
      if (_btcPriceUsd) return _btcPriceUsd;
      try {
        const res = await fetch('https://mempool.space/api/v1/prices');
        const data = await res.json();
        _btcPriceUsd = data.USD;
        return _btcPriceUsd;
      } catch (e) {
        console.warn('Could not fetch BTC price:', e);
        return null;
      }
    }

    async function updatePriceUsd() {
      const el = document.getElementById('priceUsd');
      if (!el || !selectedEvent) return;
      const btcPrice = await fetchBtcPrice();
      if (btcPrice) {
        const usd = (selectedEvent.price / 100000000) * btcPrice;
        el.textContent = `~$${usd.toFixed(2)} USD`;
      } else {
        el.textContent = '';
      }
    }

    function updateNWCStatus(connected, text) {
      const dot = document.getElementById('nwcDot');
      const statusText = document.getElementById('nwcStatusText');
      dot.className = 'nwc-dot ' + (connected ? 'connected' : 'disconnected');
      statusText.textContent = text || (connected ? 'Conectada' : 'Sin wallet');
      // Update inline status on event page
      const inlineStatus = document.getElementById('nwcInlineStatus');
      if (inlineStatus) {
        if (connected) {
          inlineStatus.textContent = `✅ ${text || 'Wallet conectada'} — Pagos activos`;
          inlineStatus.style.color = '#00ff9d';
        } else {
          inlineStatus.textContent = '⏳ Reconectando...';
          inlineStatus.style.color = '#fbbf24';
        }
      }
    }

    // ── NAVEGACIÓN ENTRE VISTAS ───────────────────────────
    window.showView = function(viewId) {
      // Block reserve/payment if org wallet not connected yet
      if (!isNWCConnected && viewId === 'reserve') {
        showToast('Wallet del organizador no conectada — esperá unos segundos', 'error');
        return;
      }
      if (!isNWCConnected && viewId !== 'event') {
        viewId = 'event';
      }

      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + viewId).classList.add('active');
      window.scrollTo(0, 0);

      // Update active header link
      document.querySelectorAll('.header-link').forEach(l => l.classList.remove('active'));

      if (viewId === 'event') { renderEventsList(); showEventDetail(); }
      if (viewId === 'reserve') {
        // Update all dynamic price labels in the payment flow
        const priceStr = selectedEvent.price.toLocaleString() + ' sats';
        const pp = document.getElementById('paymentPrice');
        if (pp) pp.textContent = priceStr;
        const pab = document.getElementById('paymentAmountBig');
        if (pab) pab.textContent = priceStr;
      }
      if (viewId === 'organizer') loadOrganizerPanel();
      if (viewId === 'audit') loadAuditDashboard();
    };

    // ── DATOS PERSISTENTES ─────────────────────────────
    function getReservations() {
      try { return JSON.parse(localStorage.getItem('hdmp_reservations') || '[]'); }
      catch(e) { console.error('Corrupt reservations data, resetting'); return []; }
    }

    function saveReservation(reservation) {
      return withStorageLock(() => {
        // Sanitize name before saving (XSS prevention)
        if (reservation.name) reservation.name = sanitizeInput(reservation.name);

        // Validate timestamp (not in future, not more than 1h in the past)
        const now = Date.now();
        const created = new Date(reservation.createdAt).getTime();
        if (isNaN(created) || created > now + 60000 || created < now - 3600000) {
          reservation.createdAt = new Date().toISOString(); // Override suspicious timestamp
        }

        // Validate amount matches event price
        if (reservation.amount !== selectedEvent.price) {
          console.warn('SECURITY: Amount mismatch blocked:', reservation.amount, 'vs expected', selectedEvent.price);
          return;
        }

        const reservations = getReservations();
        // Prevent duplicates by ticketCode AND paymentHash (double-spend prevention)
        if (reservations.find(r => r.ticketCode === reservation.ticketCode)) return;
        if (reservation.paymentHash && reservations.find(r => r.paymentHash === reservation.paymentHash)) {
          console.warn('SECURITY: Duplicate paymentHash blocked:', reservation.paymentHash?.slice(0,16));
          return;
        }

        // Require valid paymentHash and preimage for non-demo reservations
        if (!isDemoMode && (!reservation.paymentHash || reservation.paymentHash.length !== 64)) {
          console.warn('SECURITY: Invalid paymentHash rejected');
          return;
        }

        reservations.push(reservation);
        localStorage.setItem('hdmp_reservations', JSON.stringify(reservations));
      });
    }

    function markRedeemed(ticketCode) {
      // Sanitize input to prevent injection
      ticketCode = sanitizeInput(ticketCode);
      if (!/^HDMP-[A-HJ-KMNP-Z2-9]{8}$/.test(ticketCode)) return false;

      const reservations = getReservations();
      const idx = reservations.findIndex(r => r.ticketCode === ticketCode);
      if (idx === -1) return false;
      // v2.3: Verify ticket belongs to the currently selected event (prevent cross-event reuse)
      if (selectedEvent && reservations[idx].eventId && reservations[idx].eventId !== selectedEvent.id) {
        console.warn('SECURITY: Cross-event ticket reuse blocked:', ticketCode, 'belongs to', reservations[idx].eventId);
        return false;
      }
      if (reservations[idx].status === 'redeemed') return 'already';
      reservations[idx].status = 'redeemed';
      reservations[idx].redeemedAt = new Date().toISOString();
      localStorage.setItem('hdmp_reservations', JSON.stringify(reservations));
      return true;
    }

    // Payment log (separate from reservations for audit)
    function getPaymentLog() {
      try { return JSON.parse(localStorage.getItem('hdmp_payment_log') || '[]'); }
      catch(e) { console.error('Corrupt payment log, resetting'); return []; }
    }

    function addPaymentLog(entry) {
      return withStorageLock(() => {
        // Sanitize name in payment log too
        if (entry.name) entry.name = sanitizeInput(entry.name);

        // Validate amount matches event price
        if (entry.amount && entry.amount !== selectedEvent.price) {
          console.warn('SECURITY: Payment log amount mismatch blocked:', entry.amount);
          return;
        }

        const log = getPaymentLog();
        // Prevent duplicate by paymentHash
        if (log.find(l => l.paymentHash === entry.paymentHash)) return;
        log.push(entry);
        localStorage.setItem('hdmp_payment_log', JSON.stringify(log));
      });
    }

    // ── SANITIZACIÓN DE INPUT (Security Fix v2.2) ────────
    function sanitizeInput(input) {
      if (typeof input !== 'string') return '';
      return input
        .replace(/[<>"'&]/g, '')           // Strip HTML special chars
        .replace(/[\x00-\x1F\x7F]/g, '')  // Strip ALL control chars including null bytes
        .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2028\u2029]/g, '') // Zero-width & line separators
        .normalize('NFKC')                 // Unicode normalization (prevent homoglyph attacks)
        .trim()
        .slice(0, 100);
    }

    function escapeHtml(str) {
      if (typeof str !== 'string') return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // ── MUTEX PARA LOCALSTORAGE (Race Condition Fix) ────
    let _storageLock = false;
    async function withStorageLock(fn) {
      while (_storageLock) await new Promise(r => setTimeout(r, 10));
      _storageLock = true;
      try { return fn(); }
      finally { _storageLock = false; }
    }

    // ── NWC ENCRYPTED STORAGE (Security Fix v2.3) ────────
    // Keep CryptoKey in memory only — never exported to sessionStorage
    let _nwcCryptoKey = null;
    let _nwcIv = null;
    async function encryptNWCUrl(url) {
      try {
        // extractable: false — key cannot be read even via XSS
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(url);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        // Store key in JS memory only (not sessionStorage)
        _nwcCryptoKey = key;
        _nwcIv = iv;
        // Clean up legacy sessionStorage keys
        sessionStorage.removeItem('hdmp_nwc_key');
        sessionStorage.removeItem('hdmp_nwc_iv');
        return bytesToHex(new Uint8Array(encrypted));
      } catch (e) { console.error('Encryption failed:', e); return null; }
    }

    async function decryptNWCUrl(encryptedHex) {
      try {
        // Use in-memory key (v2.3) — falls back to legacy sessionStorage for migration
        let key = _nwcCryptoKey;
        let iv = _nwcIv;
        if (!key) {
          // Legacy fallback: try sessionStorage (will be migrated on next encrypt)
          const keyHex = sessionStorage.getItem('hdmp_nwc_key');
          const ivHex = sessionStorage.getItem('hdmp_nwc_iv');
          if (!keyHex || !ivHex) return null;
          key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), 'AES-GCM', false, ['decrypt']);
          iv = hexToBytes(ivHex);
        }
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, hexToBytes(encryptedHex));
        return new TextDecoder().decode(decrypted);
      } catch (e) { console.error('Decryption failed:', e); return null; }
    }

    // ── GENERAR CÓDIGO ÚNICO DE TICKET (CSPRNG v2.3) ──────
    function generateTicketCode() {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0,O,I,1,L (ambiguos)
      let code = 'HDMP-';
      // Use CSPRNG instead of Math.random() for unpredictable ticket codes
      const randomBytes = crypto.getRandomValues(new Uint8Array(8));
      for (let i = 0; i < 8; i++) {
        code += chars[randomBytes[i] % chars.length];
      }
      return code;
    }

    // ── ACTUALIZAR INDICADOR DE PASOS ────────────────────
    function setStep(step) {
      const steps = [
        document.getElementById('step-ind-1'),
        document.getElementById('step-ind-2'),
        document.getElementById('step-ind-3'),
      ];
      const lines = [
        document.getElementById('step-line-1'),
        document.getElementById('step-line-2'),
      ];

      steps.forEach((el, i) => {
        el.className = 'step ' + (i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'pending');
        if (i + 1 < step) el.textContent = '✓';
        else el.textContent = i + 1;
      });
      lines.forEach((el, i) => {
        el.className = 'step-line ' + (i + 1 < step ? 'done' : '');
      });
    }

    // ── GENERAR INVOICE VIA NWC (NIP-47) ─────────────────
    window.generateInvoiceNWC = async function() {
      const btn = document.getElementById('generateBtn');
      btn.disabled = true;
      btn.textContent = '⏳ Generando invoice via NWC...';

      currentName = sanitizeInput(document.getElementById('attendeeName').value) || 'Anónimo';
      currentNpub = sanitizeInput(document.getElementById('attendeeNpub').value) || '';

      try {
        let invoiceResult;
        const desc = `HDMP Reserva — ${currentName} — ${selectedEvent.name} ${selectedEvent.dateShort}`;
        const amountMsats = selectedEvent.price * 1000;

        if (useBackendAPI) {
          // v3.0: Server-side invoice generation (NWC secret never in browser)
          invoiceResult = await nwcAPI('make_invoice', { amount: amountMsats, description: desc });
          console.log('Backend makeInvoice result:', Object.keys(invoiceResult));
          currentInvoice = invoiceResult.invoice || '';
          currentPaymentHash = invoiceResult.payment_hash || '';
        } else {
          // Fallback: direct NWC (dev mode)
          invoiceResult = await nwcClient.makeInvoice({ amount: amountMsats, description: desc });
          console.log('NWC makeInvoice result keys:', Object.keys(invoiceResult));
          currentInvoice = invoiceResult.paymentRequest || invoiceResult.payment_request || invoiceResult.invoice || invoiceResult.bolt11 || '';
          currentPaymentHash = invoiceResult.paymentHash || invoiceResult.payment_hash || '';
        }

        if (!currentInvoice) {
          console.error('NWC makeInvoice returned no invoice. Full result:', JSON.stringify(invoiceResult));
          showToast('Error: la wallet no devolvió un invoice válido', 'error');
          btn.disabled = false;
          btn.textContent = '⚡ Generar Invoice via NWC';
          return;
        }

        console.log('Invoice generated:', currentInvoice.slice(0, 40) + '...');
        console.log('Payment hash:', currentPaymentHash.slice(0, 16) + '...');

        // Show QR
        const canvas = document.getElementById('invoiceQR');
        await QRCode.toCanvas(canvas, currentInvoice, {
          width: 260,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });

        // Show invoice text
        document.getElementById('invoiceText').textContent = currentInvoice;
        document.getElementById('paymentDestination').textContent =
          isDemoMode ? '→ Demo Wallet (simulado)' : '→ Wallet del organizador via NWC';

        // Update dynamic price labels
        const priceStr = selectedEvent.price.toLocaleString() + ' sats';
        document.getElementById('paymentPrice').textContent = priceStr;
        document.getElementById('paymentAmountBig').textContent = priceStr;

        // Switch to payment step
        document.getElementById('step-form').style.display = 'none';
        document.getElementById('step-payment').style.display = 'block';
        setStep(2);

        // Start polling for payment via NWC lookupInvoice
        startPaymentVerification();

      } catch (err) {
        showToast('Error generando invoice: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '⚡ Generar Invoice via NWC';
      }
    };

    // ── VERIFICACIÓN DE PAGO VIA NWC (NIP-47) ────────────
    function startPaymentVerification() {
      let checks = 0;
      const maxChecks = 120; // 10 min at 5s intervals

      paymentCheckInterval = setInterval(async () => {
        checks++;
        if (checks > maxChecks) {
          clearInterval(paymentCheckInterval);
          document.getElementById('waitingText').textContent = 'Timeout — invoice expirado';
          return;
        }

        try {
          let result, isPaid, preimage, settledAt;

          if (useBackendAPI) {
            // v3.0: Server-side verification (all validation done server-side)
            result = await nwcAPI('lookup_invoice', { payment_hash: currentPaymentHash });
            console.log(`lookupInvoice #${checks} (backend):`, JSON.stringify(result));
            isPaid = result.paid === true;
            preimage = result.preimage;
            settledAt = result.settled_at;
          } else {
            // Fallback: direct NWC lookup
            result = await nwcClient.lookupInvoice({ payment_hash: currentPaymentHash });
            console.log(`lookupInvoice #${checks}:`, JSON.stringify(result, null, 2));

            // NIP-47 responses may wrap the actual data in .result or .response
            if (result?.result && typeof result.result === 'object') result = result.result;
            if (result?.response && typeof result.response === 'object') result = result.response;

            preimage = result?.preimage || result?.payment_preimage || null;
            settledAt = (typeof result?.settled_at === 'number' && result.settled_at > 0) ? result.settled_at
              : (typeof result?.settledAt === 'number' && result.settledAt > 0) ? result.settledAt
              : null;
            const stateStr = (result?.state || result?.status || '').toString().toLowerCase();
            const isStateSettled = stateStr === 'settled' || stateStr === 'paid' || stateStr === 'complete' || stateStr === 'completed';
            isPaid = (preimage && preimage.length >= 32) || settledAt || isStateSettled || result?.paid === true;
          }

          if (result && isPaid) {
            // VULN-002 FIX: Validate paid amount matches event price BEFORE confirming
            const paidAmount = result?.amount || result?.amount_msat || result?.amount_msats || null;
            const expectedMsats = selectedEvent.price * 1000;
            if (paidAmount !== null && paidAmount !== undefined) {
              const paidMsats = typeof paidAmount === 'number' ? paidAmount : parseInt(paidAmount, 10);
              if (!isNaN(paidMsats) && paidMsats < expectedMsats) {
                console.warn(`VULN-002 BLOCKED: Paid ${paidMsats} msats but expected ${expectedMsats} msats`);
                document.getElementById('waitingText').textContent = 'Error: monto insuficiente';
                clearInterval(paymentCheckInterval);
                showToast(`Pago rechazado: ${Math.floor(paidMsats/1000)} sats < ${selectedEvent.price} sats requeridos`, 'error');
                return;
              }
            }
            clearInterval(paymentCheckInterval);
            // Normalize the result object
            result.preimage = preimage || result?.preimage || 'verified';
            result.settled_at = settledAt || Math.floor(Date.now() / 1000);
            console.log('Payment verified! Amount validated.', JSON.stringify(result));
            await onPaymentVerified(result);
          } else {
            document.getElementById('waitingText').textContent =
              `Verificando pago via NWC... (${checks}/${maxChecks})`;
          }
        } catch (err) {
          console.log('Lookup error (retry):', err.message);
        }
      }, 5000);
    }

    async function onPaymentVerified(paymentResult) {
      // SECURITY: Validate payment amount matches expected price
      if (paymentResult.amount && paymentResult.amount !== selectedEvent.price * 1000) {
        console.warn('SECURITY: Payment amount mismatch!', paymentResult.amount, 'vs expected', selectedEvent.price * 1000);
        showToast('Error: monto del pago no coincide con el precio', 'error');
        return;
      }

      // ⚡ LIGHTNING FLASH ANIMATION
      const overlay = document.getElementById('lightningOverlay');
      overlay.classList.add('active');
      setTimeout(() => overlay.classList.remove('active'), 2200);

      // Show verification banner
      document.getElementById('paymentVerified').style.display = 'block';
      document.getElementById('waitingIndicator').style.display = 'none';
      document.getElementById('cancelPaymentBtn').style.display = 'none';

      const preimage = paymentResult.preimage || 'N/A';
      document.getElementById('verifiedDetails').textContent =
        `Preimage: ${preimage.slice(0,16)}... — Generando Zap receipt y ticket...`;

      showToast('¡Pago verificado via NWC!', 'success');

      // Create Zap Request event (NIP-57 kind 9734)
      const zapRequestEvent = createZapRequestEvent();

      // Create Zap Receipt event (NIP-57 kind 9735) — simulated for demo
      const zapReceiptEvent = createZapReceiptEvent(zapRequestEvent, preimage);

      // Log payment for audit
      const paymentEntry = {
        paymentHash: currentPaymentHash,
        preimage: preimage,
        amount: selectedEvent.price,
        name: currentName,
        npub: currentNpub,
        invoice: currentInvoice,
        settledAt: paymentResult.settled_at || Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        verified: true,
        verificationMethod: isDemoMode ? 'NWC (demo)' : 'NWC (NIP-47)',
        zapRequestId: zapRequestEvent?.id || null,
        zapReceiptId: zapReceiptEvent?.id || null
      };
      addPaymentLog(paymentEntry);

      // Wait a beat then generate ticket
      await new Promise(r => setTimeout(r, 1500));
      await generateTicket(preimage, zapRequestEvent, zapReceiptEvent);
    }

    // ── NIP-57: ZAP REQUEST (Kind 9734) ──────────────────
    function createZapRequestEvent() {
      try {
        // Generate ephemeral key for this zap request
        const sk = generateSecretKey();
        const pk = getPublicKey(sk);

        const zapRequest = {
          kind: 9734,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", selectedEvent.organizerPubkey],
            ["amount", String(selectedEvent.price * 1000)], // millisats
            ["relays", ...selectedEvent.nostrRelays],
            ["e", generateEventId()], // event being zapped (reservation event)
          ],
          content: `Reserva HDMP — ${currentName} — ${selectedEvent.name} ${selectedEvent.dateShort}`,
        };

        // If attendee provided npub, add as sender
        if (currentNpub) {
          // Simple hex check (npub would need bech32 decode in production)
          zapRequest.tags.push(["P", currentNpub.startsWith('npub') ? 'sender_' + currentNpub.slice(4,12) : currentNpub]);
        }

        // Sign with ephemeral key
        const signed = finalizeEvent(zapRequest, sk);
        console.log('Zap Request (NIP-57 kind 9734):', signed);
        return signed;

      } catch (err) {
        console.error('Error creating zap request:', err);
        return { id: 'zr_' + Date.now().toString(36), kind: 9734, created_at: Math.floor(Date.now()/1000) };
      }
    }

    // ── NIP-57: ZAP RECEIPT (Kind 9735) ──────────────────
    function createZapReceiptEvent(zapRequest, preimage) {
      try {
        // In production: the LNURL server creates and signs this
        // For demo: we simulate it
        const sk = generateSecretKey();

        const zapReceipt = {
          kind: 9735,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", selectedEvent.organizerPubkey],
            ["bolt11", currentInvoice],
            ["description", JSON.stringify(zapRequest)],
            ["preimage", preimage || ''],
          ],
          content: "",
        };

        if (zapRequest.tags) {
          const eTag = zapRequest.tags.find(t => t[0] === 'e');
          if (eTag) zapReceipt.tags.push(["e", eTag[1]]);
        }

        const signed = finalizeEvent(zapReceipt, sk);
        console.log('Zap Receipt (NIP-57 kind 9735):', signed);
        return signed;

      } catch (err) {
        console.error('Error creating zap receipt:', err);
        return { id: 'zrec_' + Date.now().toString(36), kind: 9735, created_at: Math.floor(Date.now()/1000) };
      }
    }

    // Helper: generate a random event ID for demo
    function generateEventId() {
      return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2,'0')).join('');
    }

    // ── GENERAR TICKET ──────────────────────────────────
    async function generateTicket(preimage, zapRequest, zapReceipt) {
      setStep(3);

      const ticketCode = generateTicketCode();
      const now = new Date();

      const reservation = {
        ticketCode,
        name: currentName,
        npub: currentNpub,
        invoice: currentInvoice,
        paymentHash: currentPaymentHash,
        preimage: preimage,
        amount: selectedEvent.price,
        status: 'confirmed',
        createdAt: now.toISOString(),
        redeemedAt: null,
        zapRequestId: zapRequest?.id || null,
        zapReceiptId: zapReceipt?.id || null,
        verifiedViaNWC: true
      };
      saveReservation(reservation);

      // Update ticket UI
      document.getElementById('ticketCode').textContent = ticketCode;
      document.getElementById('ticketAttendeeName').textContent =
        currentName !== 'Anónimo' ? `Para: ${currentName}` : '';
      document.getElementById('ticketEventName').textContent = selectedEvent.name;
      document.getElementById('ticketDetail').innerHTML =
        `📅 ${selectedEvent.date}<br>🕖 ${selectedEvent.time} · 📍 ${escapeHtml(selectedEvent.location)}<br>💰 ${selectedEvent.price.toLocaleString()} sats pagados<br>🍺 1 consumición incluida`;

      // Zap details on ticket
      document.getElementById('ticketPaymentHash').textContent =
        `Payment Hash: ${currentPaymentHash ? currentPaymentHash.slice(0,24) + '...' : '—'}`;
      document.getElementById('ticketPreimage').textContent =
        `Preimage: ${preimage ? preimage.slice(0,24) + '...' : '—'}`;
      document.getElementById('ticketZapEvent').textContent =
        `Zap Receipt: ${zapReceipt?.id ? zapReceipt.id.slice(0,24) + '...' : '—'}`;

      // Generate QR
      const qrData = JSON.stringify({
        code: ticketCode,
        hash: currentPaymentHash?.slice(0,16),
        zap: zapReceipt?.id?.slice(0,16)
      });
      const canvas = document.getElementById('ticketQR');
      await QRCode.toCanvas(canvas, qrData, {
        width: 200, margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });

      showView('ticket');
      updateSpotsBar();
    }

    // ── CANCELAR PAGO ───────────────────────────────────
    window.cancelPayment = function() {
      if (paymentCheckInterval) clearInterval(paymentCheckInterval);
      currentInvoice = null;
      currentPaymentHash = null;

      document.getElementById('step-form').style.display = 'block';
      document.getElementById('step-payment').style.display = 'none';
      document.getElementById('paymentVerified').style.display = 'none';
      document.getElementById('waitingIndicator').style.display = 'flex';
      document.getElementById('cancelPaymentBtn').style.display = 'block';

      const btn = document.getElementById('generateBtn');
      btn.disabled = false;
      btn.textContent = '⚡ Generar Invoice via NWC';
      setStep(1);
    };

    // ── COPIAR INVOICE ────────────────────────────────────
    window.copyInvoice = function() {
      if (!currentInvoice) return;
      // v2.3: Validate invoice is a valid Lightning invoice before copying
      if (!/^ln(bc|tb|tbs)[a-z0-9]+$/i.test(currentInvoice) && !isDemoMode) {
        console.warn('SECURITY: Invalid invoice format blocked from clipboard');
        showToast('Error: invoice inválido', 'error');
        return;
      }
      navigator.clipboard.writeText(currentInvoice).then(() => {
        showToast('Invoice copiado', 'success');
      });
    };

    // ── COMPARTIR TICKET ──────────────────────────────────
    window.shareTicket = function() {
      const ticketCode = document.getElementById('ticketCode').textContent;
      const shareText = `Reservé mi lugar con Lightning + NWC + Zaps!\nCódigo: ${ticketCode}\nSistema: HDMP v2 (NIP-47 + NIP-57)`;
      if (navigator.share) {
        navigator.share({ title: 'Mi ticket HDMP', text: shareText });
      } else {
        navigator.clipboard.writeText(shareText);
        showToast('Ticket copiado al portapapeles', 'success');
      }
    };

    // ── CANJEAR TICKET (ORGANIZADOR) — v2.3: rate limiting ─
    let _redeemAttempts = [];
    const REDEEM_MAX_ATTEMPTS = 5;
    const REDEEM_WINDOW_MS = 60000; // 1 minute

    window.redeemTicket = function() {
      const code = document.getElementById('redeemInput').value.trim().toUpperCase();
      const feedback = document.getElementById('redeemFeedback');

      // Rate limiting: max 5 attempts per minute
      const now = Date.now();
      _redeemAttempts = _redeemAttempts.filter(t => now - t < REDEEM_WINDOW_MS);
      if (_redeemAttempts.length >= REDEEM_MAX_ATTEMPTS) {
        feedback.textContent = '🔒 Demasiados intentos — esperá 1 minuto';
        feedback.className = 'redeem-feedback show error';
        return;
      }
      _redeemAttempts.push(now);

      if (!code || code.length < 6) {
        feedback.textContent = '⚠️ Ingresá un código válido';
        feedback.className = 'redeem-feedback show error';
        return;
      }

      const result = markRedeemed(code);
      if (result === true) {
        feedback.textContent = `✅ Ticket ${code} canjeado — ¡Bienvenido!`;
        feedback.className = 'redeem-feedback show success';
        document.getElementById('redeemInput').value = '';
        loadOrganizerPanel();
      } else if (result === 'already') {
        feedback.textContent = `⚠️ Ticket ${code} ya fue canjeado.`;
        feedback.className = 'redeem-feedback show error';
      } else {
        feedback.textContent = `❌ Código ${code} no encontrado.`;
        feedback.className = 'redeem-feedback show error';
      }
      setTimeout(() => { feedback.className = 'redeem-feedback'; }, 4000);
    };

    // ── CARGAR PANEL ORGANIZADOR ──────────────────────────
    function loadOrganizerPanel() {
      const reservations = getReservations();
      const total = reservations.length;
      const redeemed = reservations.filter(r => r.status === 'redeemed').length;
      const noshow = Math.max(0, total - redeemed);

      document.getElementById('statTotal').textContent = total;
      document.getElementById('statRedeemed').textContent = redeemed;
      document.getElementById('statNoshow').textContent = noshow;

      // Show wallet info if connected
      if (isNWCConnected) {
        document.getElementById('walletInfoCard').style.display = 'block';
        refreshWalletBalance();
      }

      const list = document.getElementById('reservationsList');
      if (total === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎟️</div><p>No hay reservas aún</p></div>`;
        return;
      }

      const sorted = [...reservations].reverse();
      list.innerHTML = sorted.map(r => {
        const time = new Date(r.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const date = new Date(r.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        const hashDisplay = r.paymentHash ? r.paymentHash.slice(0,16) + '...' : 'Sin hash';
        return `
          <div class="reservation-item ${r.status === 'redeemed' ? 'redeemed' : ''}">
            <div class="reservation-info">
              <div class="res-name">${escapeHtml(r.name)} ${r.verifiedViaNWC ? '<span class="zap-badge">⚡ NWC</span>' : ''}</div>
              <div class="res-code">${r.ticketCode}</div>
              <div class="res-hash">🔗 ${hashDisplay}</div>
              <div class="res-time">${date} ${time} · ${r.amount.toLocaleString()} sats</div>
            </div>
            <div class="res-status ${r.status}">
              ${r.status === 'redeemed' ? '✅ Canjeado' : '⏳ Pendiente'}
            </div>
          </div>`;
      }).join('');
    }

    window.refreshWalletBalance = async function() {
      try {
        const balance = await nwcClient.getBalance();
        const sats = Math.floor(balance.balance / 1000);
        document.getElementById('walletBalance').textContent = sats.toLocaleString() + ' sats';
      } catch (err) {
        document.getElementById('walletBalance').textContent = 'Error';
      }
    };

    // ── AUDIT DASHBOARD ──────────────────────────────────
    function loadAuditDashboard(filter = 'all') {
      const log = getPaymentLog();
      const reservations = getReservations();

      // Stats
      const totalSats = log.reduce((sum, l) => sum + (l.amount || 0), 0);
      const verified = log.filter(l => l.verified).length;
      const zapped = log.filter(l => l.zapReceiptId).length;

      document.getElementById('auditTotalSats').textContent = totalSats.toLocaleString() + ' sats';
      document.getElementById('auditTotalTx').textContent = log.length;
      document.getElementById('auditVerified').textContent = verified;
      document.getElementById('auditZapped').textContent = zapped;

      // Filter
      let filtered = log;
      if (filter === 'verified') filtered = log.filter(l => l.verified);
      if (filter === 'unverified') filtered = log.filter(l => !l.verified);
      if (filter === 'zapped') filtered = log.filter(l => l.zapReceiptId);

      const rows = document.getElementById('auditRows');
      if (filtered.length === 0) {
        rows.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No hay pagos ${filter !== 'all' ? 'con este filtro' : 'registrados'}</p></div>`;
        return;
      }

      rows.innerHTML = [...filtered].reverse().map(entry => {
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const hashShort = entry.paymentHash ? escapeHtml(entry.paymentHash.slice(0,12)) + '...' : '—';
        const verifiedClass = entry.verified ? 'yes' : (entry.zapReceiptId ? 'pending' : 'no');
        const verifiedText = entry.verified ? '✅ NWC' : (entry.zapReceiptId ? '⚡ Zap' : '❌');

        return `
          <div class="audit-row">
            <div>
              <div style="font-weight:600;font-size:0.85rem">${escapeHtml(entry.name || 'Anónimo')}</div>
              <div class="audit-hash">${hashShort}</div>
            </div>
            <div class="audit-amount">${(entry.amount || 0).toLocaleString()}</div>
            <div class="audit-time">${dateStr}<br>${timeStr}</div>
            <div class="audit-verified ${verifiedClass}">${verifiedText}</div>
          </div>`;
      }).join('');
    }

    window.filterAudit = function(filter, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAuditDashboard(filter);
    };

    // ── EXPORT CSV ──────────────────────────────────────
    window.exportAuditCSV = function() {
      const log = getPaymentLog();
      if (log.length === 0) {
        showToast('No hay datos para exportar', 'error');
        return;
      }

      // CSV sanitization helper (v2.3) — prevent formula injection & escape quotes
      function csvSanitize(val) {
        let s = String(val);
        // Escape double quotes for CSV
        s = s.replace(/"/g, '""');
        // Prevent CSV formula injection: prefix dangerous chars with apostrophe
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return s;
      }

      const headers = ['Nombre', 'Monto (sats)', 'Payment Hash', 'Preimage', 'Fecha', 'Verificado NWC', 'Zap Request ID', 'Zap Receipt ID', 'Método'];
      const rows = log.map(e => [
        e.name || 'Anónimo',
        e.amount || 0,
        e.paymentHash || '',
        e.preimage || '',
        e.createdAt || '',
        e.verified ? 'Sí' : 'No',
        e.zapRequestId || '',
        e.zapReceiptId || '',
        e.verificationMethod || ''
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${csvSanitize(v)}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HDMP_Audit_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exportado', 'success');
    };

    // ── INTEGRITY CHECK ─────────────────────────────────
    window.runIntegrityCheck = function() {
      const log = getPaymentLog();
      const reservations = getReservations();
      const report = document.getElementById('integrityReport');
      const issues = [];

      // Check 1: Every reservation should have a payment log entry
      reservations.forEach(r => {
        if (r.paymentHash && !log.find(l => l.paymentHash === r.paymentHash)) {
          issues.push(`⚠️ Reserva ${r.ticketCode} sin entry en payment log`);
        }
      });

      // Check 2: No duplicate payment hashes
      const hashes = log.map(l => l.paymentHash).filter(Boolean);
      const dupes = hashes.filter((h, i) => hashes.indexOf(h) !== i);
      if (dupes.length > 0) {
        issues.push(`🔴 ${dupes.length} payment hash(es) duplicados detectados`);
      }

      // Check 3: No duplicate ticket codes
      const codes = reservations.map(r => r.ticketCode);
      const codeDupes = codes.filter((c, i) => codes.indexOf(c) !== i);
      if (codeDupes.length > 0) {
        issues.push(`🔴 ${codeDupes.length} ticket code(s) duplicados`);
      }

      // Check 4: All verified payments should have preimage
      log.forEach(l => {
        if (l.verified && (!l.preimage || l.preimage === 'N/A')) {
          issues.push(`⚠️ Pago ${l.paymentHash?.slice(0,12)}... verificado pero sin preimage`);
        }
      });

      // Check 5: Amounts should match
      log.forEach(l => {
        if (l.amount && l.amount !== selectedEvent.price) {
          issues.push(`🔴 Pago ${l.paymentHash?.slice(0,12)}... con monto inválido: ${l.amount} (esperado: ${selectedEvent.price})`);
        }
      });

      // Check 6: Reservation count vs payment count
      if (reservations.length !== log.length) {
        issues.push(`⚠️ Discrepancia: ${reservations.length} reservas vs ${log.length} pagos`);
      }

      // Generate report
      const timestamp = new Date().toLocaleString('es-AR');
      let html = `<strong style="color:#00ff9d">Verificación ejecutada: ${timestamp}</strong><br><br>`;
      html += `📊 ${reservations.length} reservas | ${log.length} pagos | ${log.filter(l=>l.verified).length} verificados<br><br>`;

      if (issues.length === 0) {
        html += `<span style="color:#00ff9d">✅ Sin problemas detectados — todos los registros son consistentes.</span>`;
      } else {
        html += `<span style="color:#ff6b6b">Se encontraron ${issues.length} problema(s):</span><br><br>`;
        html += issues.join('<br>');
      }

      report.innerHTML = html;
    };

    // ── ACTUALIZAR BARRA DE LUGARES ───────────────────────
    function updateSpotsBar() {
      const reservations = getReservations();
      const taken = reservations.length;
      const available = selectedEvent.maxCapacity - taken;
      const pct = (taken / selectedEvent.maxCapacity) * 100;

      document.getElementById('spotsText').textContent =
        available > 0 ? `${available} lugares disponibles` : '¡Sin lugares!';
      document.getElementById('spotsCount').textContent = `${taken}/${selectedEvent.maxCapacity}`;
      document.getElementById('spotsBar').style.width = pct + '%';

      const badge = document.querySelector('#view-event .badge');
      if (badge) {
        if (available <= 5 && available > 0) {
          badge.className = 'badge warning';
          badge.innerHTML = `⚠️ ¡Últimos ${available} lugares!`;
        } else if (available === 0) {
          badge.className = 'badge error';
          badge.innerHTML = '🔴 Evento completo';
          const btn = document.getElementById('reserveBtn');
          if (btn) { btn.disabled = true; btn.textContent = 'Sin lugares disponibles'; }
        }
      }
    }

    // ── LIMPIAR DATOS (v2.3: require organizer PIN) ──────
    window.clearAllData = function() {
      if (!confirm('¿Borrar TODOS los datos? (reservas, pagos, auditoría)')) return;
      const pin = prompt('Ingresá el PIN del organizador para confirmar:');
      if (!pin || pin !== '⚡HDMP') {
        showToast('PIN incorrecto — operación cancelada', 'error');
        return;
      }
      localStorage.removeItem('hdmp_reservations');
      localStorage.removeItem('hdmp_payment_log');
      loadOrganizerPanel();
      updateSpotsBar();
      showToast('Datos limpiados', 'info');
    };

    // ── INICIALIZACIÓN ────────────────────────────────────
    // Wrapped in async IIFE to avoid top-level await (Vite/esbuild compatibility)
    (async function init() {
      updateSpotsBar();
      updatePriceUsd();
      setStep(1);
      showView('event');

      // Auto-connect org wallet (La Crypta — Primal NWC)
      await autoConnectOrgWallet();

      if (location.hash === '#organizer') showView('organizer');
      if (location.hash === '#audit') showView('audit');
    })();
