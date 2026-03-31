# Changelog — HDMP Proof of Attendance

## [3.3.0] — 2026-03-31 — NIP-57 Zap Receipt Verification + Final

### Added
- **NIP-57 Zap receipt verification**: verificación automática de pagos via kind 9735 en relays públicos (relay.damus.io, nos.lol, relay.primal.net), completamente independiente del relay NWC
- **Firmas Schnorr (BIP-340)**: Zap requests (kind 9734) firmadas server-side con @noble/curves/secp256k1
- **LNURL-first strategy**: genera invoices via LNURL primero (incluye Zap request en parámetro `nostr`), NWC como fallback
- **Verificación dual paralela**: Zap receipt monitor (WebSocket en browser) + NWC lookupInvoice (server polling) — el primero que confirma gana
- **Staff Attendee List**: lista de todos los asistentes con búsqueda en tiempo real por nombre o código HDMP en panel Staff
- **Banner de pago verificado**: scroll-margin-top + scrollIntoView con delay para visibilidad correcta con sticky header
- **Zap metadata en respuesta**: make_invoice devuelve zap_pubkey, zap_recipient, zap_relays para el monitor del cliente

### Fixed
- **Payment verification stuck forever**: Primal NWC relay solo procesa comandos con app abierta → Zap receipt verification en relays públicos resuelve esto
- **Green banner hidden behind sticky header**: agregado scroll-margin-top: 100px y scrollIntoView({ block: 'start' }) con 150ms delay

### Changed
- Ticket prices restaurados a 2100 sats (producción)
- Title actualizado a HDMP v3.3
- make_invoice intenta LNURL antes que NWC (era al revés)
- Zap receipt monitor se limpia correctamente en cancelPayment

### Testing
- **Todas las pruebas funcionales completadas con éxito**:
  - Pagos Lightning reales (LNURL-first + NWC fallback)
  - Verificación automática de pagos (NIP-57 Zap receipt + NWC dual)
  - Generación y escaneo de QR codes (staff scanner)
  - Staff attendee list con búsqueda en tiempo real
  - Validación de entrada (puerta) y consumición (barra)
  - Verificación de tickets por QR y por buscador
  - Publicación de Zaps en relays Nostr
  - Verificación pública de tickets

---

## [3.2.0] — 2026-03-28 — LNURL Fallback + Payment Resilience

### Added
- **LNURL-pay fallback**: cuando el relay NWC falla, genera invoices via Lightning Address (HTTP puro)
- **Decodificación bolt11**: extrae payment_hash del invoice con decoder bech32 custom, sin depender del relay
- **Timeout server-side**: NWC 5s + LNURL 4s = siempre responde antes del límite de Vercel (10s)
- **Retry automático**: hasta 3 intentos con mensajes "Relay lento — reintentando"
- **Backoff progresivo**: verificación de pago 5s → 8s → 15s cuando el relay está lento
- **get_info resiliente**: devuelve "connected" cuando LNURL está disponible
- **Cleanup WebSocket**: cierra conexiones en finally block (previene memory leaks)

---

## [3.1.0] — 2026-03-27 — Zaps en Relays Reales + Verificación Pública

### Added
- **Zaps publicados en relays Nostr REALES**: relay.damus.io, nos.lol, relay.nostr.band
- **SimplePool** de nostr-tools para publicación multi-relay
- **Página de verificación pública**: `#verify/HDMP-XXXXXXXX`
- **Links a njump.me y nostr.band** para verificar Zaps on-chain
- **hashchange listener** para navegación dinámica de verify links
- **Ticket muestra status de publicación** en relays post-pago

---

## [3.0.1] — 2026-03-25 — Pentest Ronda 4

### Security Fixes (3 CRITICAL + 4 HIGH)
- **XSS via paymentHash en onclick** → reemplazado con event delegation + data attributes
- **Staff PIN sin rate limiting** → 5 intentos / 15 min con bloqueo por IP
- **PIN fallback client-side '1234'** → eliminado, fail closed (solo server-side)
- **PIN comparison no timing-safe** → crypto.timingSafeEqual con buffer padding
- **Tickets sin firma aceptados por staff** → rechazados, solo server-signed
- **Invoice description sin sanitizar** → max 500 chars, strip control chars
- **Error messages revelando info del backend** → mensajes genéricos

---

## [3.0.0] — 2026-03-24 — Jury Feedback Implementation

### Security Fixes
- **VULN-002 resolved**: Server-side and client-side validation that paid amount matches event price. Underpayments are rejected before ticket generation.
- **NWC secret moved to backend**: Vercel serverless API (`/api/nwc`) handles all wallet operations. Secret never reaches the browser. Client falls back to direct NWC only in dev mode.
- **Server-signed tickets**: HMAC-SHA256 signatures on ticket data via `/api/verify-ticket`. Prevents localStorage manipulation — forged tickets fail signature verification.

### Architecture
- **Code modularized**: CSS extracted to `src/css/styles.css`, JS logic to `src/js/app.js`, canvas animation to `src/js/dots.js`. Index.html retains inline versions for single-file deployment compatibility.
- **Vercel serverless functions**: `api/nwc.js` (invoice generation, payment verification, balance check) + `api/verify-ticket.js` (HMAC ticket signing/verification).
- **Backend-first architecture**: Client tries `/api/nwc` first, falls back to direct NWC if API unavailable (local dev).

### UI/UX
- **Official La Crypta SVG logo** with centered "Proof of Attendance (HDMP)" subtitle
- **Canvas dot grid background** with animated upward flow (replaced CSS radial-gradient approach)
- **Apple liquid glass design**: translucent cards with backdrop-filter blur, grey tint, deep layered shadows
- **Event title/subtitle centered**
- **Wallet updated** to new Primal NWC connection

### Jury Feedback Addressed
1. ✅ VULN-002 (amount validation) — RESOLVED with dual client+server validation
2. ✅ NWC secret in client — RESOLVED with Vercel backend API
3. ✅ Single file monolith — RESOLVED with modular file structure
4. ✅ Client-side only security — RESOLVED with server-signed tickets (HMAC-SHA256)

---

## [2.5.0] — 2026-03-17 — Production Live Mode

### Breaking Changes
- **Demo mode removed** — App now uses real NWC wallet for all payments
- **Org wallet hardcoded** — La Crypta's Primal wallet auto-connects on page load. Attendees never see NWC config.
- **NWC config moved to organizer panel** — Only accessible behind PIN (⚡HDMP)

### Added
- **Seamless attendee flow** — Arrive → see event → reserve → pay QR → done. No wallet config needed.
- **Auto-connect org wallet** — `autoConnectOrgWallet()` connects La Crypta's Primal NWC on init
- **Dynamic sats→USD conversion** — Real-time BTC price via `mempool.space/api/v1/prices`, updates automatically
- **Robust payment verification** — `lookupInvoice` now handles NIP-47 response wrappers (`.result`, `.response`) and detects multiple field name variations: `preimage`, `payment_preimage`, `settled_at`, `settledAt`, `paid`, `state`, `status`, `amount_msats`
- **Multi-wallet compatibility** — Tested and normalized for Primal, Alby, and Mutiny NWC implementations
- **Enhanced debug logging** — First 5 lookupInvoice responses logged in full for troubleshooting

### Fixed
- **False payment confirmation** — `isPaid` heuristic was too loose: `amount > 0 + created_at` triggered on unpaid invoices. Now requires STRONG signals only: preimage (32+ chars), numeric `settled_at > 0`, explicit state "settled"/"paid", or `paid === true`
- **nwcMock auto-confirming** — Demo mock `lookupInvoice` auto-confirmed after 3 checks. Mock removed entirely — zero fake payments possible
- **Duplicate element ID bug** — Two `<textarea id="nwcInput">` existed (old screen + new inline), causing `getElementById` to read from the wrong (empty) element. Old view removed entirely.
- **Hardcoded "1,000 sats"** in 3 payment flow locations — Now updates dynamically from `selectedEvent.price`
- **Static USD price ($0.60)** — Replaced with live calculation via mempool.space API
- **"No input text" QR error** — `makeInvoice` response field normalized (`paymentRequest` / `payment_request` / `invoice` / `bolt11`)
- **La Crypta logo blocked by CSP** — Added `https://avatars.githubusercontent.com` to `img-src` policy

### Security
- **NWC secret ofuscado** — Base64 encoded in source, decoded at runtime via `atob()`. Not in plaintext in repo.

### Changed
- Event prices set to 10 sats for live testing (configurable in `EVENTS_LIST`)
- NWC "Reconfigurar" button in organizer panel now opens inline box instead of old separate screen
- Version bumped to 2.5.0

---

## [2.3.0] — 2026-03-17 — Advanced White Hat Pentest + Deep Hardening

### Security (13 fixes from 26 advanced pentest scenarios)
- **Content Security Policy (CSP)**: `script-src 'self' https://esm.sh`, `frame-ancestors 'none'`
- **X-Frame-Options**: DENY + X-Content-Type-Options + Referrer-Policy headers
- **CSPRNG ticket codes**: `crypto.getRandomValues()` replaces `Math.random()`
- **8-char ticket codes**: increased from 6 → 8 chars (729M → 656B combinations)
- **Non-extractable AES key**: `extractable: false`, key in JS memory only (not sessionStorage)
- **Audit row XSS fix**: `escapeHtml()` applied to paymentHash in innerHTML
- **CSV formula injection**: new `csvSanitize()` prefixes `=`, `+`, `-`, `@` with apostrophe
- **CSV delimiter escape**: double quotes escaped (`"` → `""`) in all CSV values
- **@getalby/sdk pinned**: exact version `@3.5.1` (was semver range `@3`)
- **Cross-event ticket reuse**: `markRedeemed()` verifies `eventId === selectedEvent.id`
- **clearAllData auth**: requires organizer PIN (`⚡HDMP`) in addition to confirm()
- **Rate limiting**: max 5 redeem attempts per minute with 60s sliding window
- **Invoice clipboard validation**: validates Lightning invoice format before copying

### Added
- `tests/advanced-pentest-v3.js` — 26 advanced scenarios (DOM XSS, prototype pollution, supply chain, crypto, CSV injection, brute force, cross-event, clickjacking, global scope)
- `npm run test:advanced` script
- Source code fix detection in pentest v3 (reads index.html for pattern matching)

### Changed
- Ticket code regex updated to `{8}` everywhere (index.html, unit tests, pentest files)
- `npm run test:all` now runs all 3 test suites (104 total scenarios)
- package.json version bumped to 2.3.0

---

## [2.1.0] — 2026-03-15 — Multi-Event + Visual Refresh

### Added
- **Multi-event system**: soporte para múltiples eventos con selector visual
  - 4 eventos Cowork de La Crypta (Mar 17, 24, 31 y Abr 7)
  - Event cards con date badges, hover effects y estado seleccionado
  - Detalle dinámico del evento al seleccionar (fecha, hora, ubicación, capacidad)
  - Ticket y factura vinculados al evento seleccionado
- **La Crypta branding**: logo oficial (GitHub avatar), "La Crypta presenta" header
- **Dirección real**: Villanueva 1367 — La Crypta, Buenos Aires

### Changed
- Título principal: "Proof of Attendance (HDMP)" (antes "Lightning Hackathon FOUNDATIONS")
- Layout: detalle del evento + botón reservar arriba, lista de eventos debajo
- **Visual refresh completo**:
  - Fuentes Inter + JetBrains Mono (Google Fonts)
  - CSS custom properties (design tokens) para theming consistente
  - Paleta refinada: gold (#f7931a, Bitcoin orange), purple, green
  - Glass morphism con backdrop-filter en header y cards
  - Background con gradientes radiales ambient (purple/gold)
  - Animaciones: glow en rayo, fade-in en vistas, shimmer en ticket, pulse en status
  - Hover states mejorados en cards, botones y links
  - Focus ring con glow dorado en inputs
  - Protocol badges (NIP-47/NIP-57) con background coloreado

---

## [2.0.0] — 2026-03-15 — NWC + Zaps + Security Audit

### Added
- **NIP-47 (Nostr Wallet Connect)** como backend principal de pagos
  - `makeInvoice` para generar invoices desde la wallet del organizador
  - `lookupInvoice` con polling automático para verificar pagos
  - `getBalance` para mostrar balance en el panel del organizador
  - Pantalla de NWC Setup con conexión y modo demo
- **NIP-57 (Zaps)** para registro de pagos en Nostr
  - Kind 9734 (Zap Request) firmado con ephemeral key
  - Kind 9735 (Zap Receipt) con bolt11, preimage y description
- **Audit Dashboard** — nueva vista con:
  - Stats de pagos (total recaudado, transacciones, verificados, con zap)
  - Filtros (todos, verificados, sin verificar, con zap)
  - Tabla detallada con nombre, hash, monto, fecha, estado
  - Export a CSV
  - Verificación de integridad de datos
- **46 unit tests** cubriendo ticket generation, CRUD, payment log, validaciones NIP-47/NIP-57, sanitización
- **22 escenarios de pentest** en 7 categorías: replay, injection, invoice manipulation, XSS, double-spend, NWC security, data integrity
- **Reporte formal de seguridad** (SECURITY-AUDIT.md) con clasificación CVSS
- `sanitizeInput()` y `escapeHtml()` para prevención de XSS
- Deduplicación por `paymentHash` en reservas (prevención de double-spend)
- `try/catch` en JSON.parse para crash recovery
- Redacción del NWC secret en console.log
- Campo npub (Nostr pubkey) en formulario de reserva
- Ticket con datos del Zap (payment hash, preimage, zap event ID)
- Toast notifications
- NWC status indicator en header

### Changed
- Verificación de pago: de manual ("Ya pagué") a automática via NWC lookupInvoice
- Charset de ticket codes: removido L (ambiguo con 1)
- localStorage keys: renombrado de `poa_*` a `hdmp_*`
- package.json: versión 2.0.0, scripts de test agregados

### Security Fixes
- XSS: sanitización de input + escape en rendering (VULN-006, VULN-007)
- Double-spend: deduplicación por paymentHash (VULN-004)
- DoS: try/catch en JSON.parse corrupto (VULN-012)
- Info leak: redacción de NWC secret en logs (VULN-013)
- Unicode: filtrado de zero-width chars y null bytes (VULN-015, VULN-016, VULN-017)

## [1.0.0] — 2026-03-04 — MVP Inicial

### Added
- Sistema de reservas con depósito en Lightning Network
- 4 pantallas: evento, pago, ticket, panel del organizador
- Pagos via Lightning Address (LNURL) con @getalby/lightning-tools
- QR code de invoice y de ticket
- Panel del organizador con stats y canje de tickets
- Persistencia en localStorage
