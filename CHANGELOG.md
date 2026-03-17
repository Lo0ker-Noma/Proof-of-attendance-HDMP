# Changelog — HDMP Proof of Attendance

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
