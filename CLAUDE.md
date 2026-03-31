# CLAUDE.md — Contexto del proyecto para evaluadores (humanos e IA)

## Proyecto

**HDMP v3.3 — Proof of Attendance** es un sistema de reservas para eventos con depósito en Lightning Network, verificación automática dual (NIP-57 Zap receipts + NWC), backend serverless, staff scanner con lista de asistentes, y verificación pública en Nostr. App en producción con pagos reales.

**Live**: https://proof-of-attendance-hdmp.vercel.app

## Evolución v1 → v3.3

### v1 (semana 1)
- Single-file app con 4 pantallas
- Pagos via Lightning Address (LNURL)
- Verificación de pago manual ("Ya pagué")
- Sin tests, sin seguridad, sin auditoría
- ~900 líneas de código

### v2.0 (semana 2)
- 6 pantallas incluyendo NWC Setup y Audit Dashboard
- Pagos via **NWC (NIP-47)**: makeInvoice, lookupInvoice, getBalance
- **Zaps (NIP-57)**: kind 9734 (zap request) + kind 9735 (zap receipt)
- 46 unit tests + 22 escenarios de pentest

### v2.1 → v2.3 (semana 3 - seguridad)
- Multi-evento con 4 Coworks de La Crypta
- Diseño premium con glassmorphism + animaciones
- 26 escenarios de pentest avanzado adicionales
- 21 fixes de seguridad aplicados (CSPRNG, CSP, AES non-extractable, CSV sanitization, rate limiting)

### v2.5 (semana 3 - producción)
- **Pagos reales en producción** — Demo mode eliminado
- NWC inline en la página del evento (sin pantalla separada)
- Multi-wallet: Primal, Alby, Mutiny (normalización de campos NIP-47)
- Precio dinámico sats→USD via mempool.space API

### v3.0 (semana 4 - backend serverless)
- Migración a **Vercel Serverless Functions** — NWC secret nunca se expone al cliente
- 3 API endpoints: `/api/nwc`, `/api/verify-ticket`, `/api/staff-verify`
- **Staff QR Scanner** con PIN server-side, rate limiting, timingSafeEqual
- Firma HMAC-SHA256 server-side para tickets
- QR v3 self-contained (datos + firma para verificación cross-device)

### v3.0.1 (semana 4 - pentest ronda 4)
- 4ta ronda de auditoría: 3 CRITICAL + 4 HIGH encontrados y arreglados
- XSS via onclick → event delegation, PIN sin rate limiting → 5/15min, PIN fallback client-side → eliminado

### v3.1 (semana 4 - Zaps en relays reales)
- Zaps publicados en relays Nostr reales (relay.damus.io, nos.lol, relay.nostr.band)
- Página de verificación pública: `#verify/HDMP-XXXXXXXX`
- Links a njump.me y nostr.band para verificar Zaps on-chain

### v3.2 (semana 4 - resiliencia)
- LNURL-pay fallback cuando relay NWC falla
- Decodificación bolt11 para extraer payment_hash sin relay
- Retry automático con backoff progresivo
- JSON seguro: servidor siempre devuelve JSON válido

### v3.3 (semana 5 - verificación dual + final)
- **NIP-57 Zap receipt verification**: verificación de pagos via kind 9735 en relays públicos, independiente del relay NWC
- **Firmas Schnorr (BIP-340)**: Zap requests firmadas server-side con @noble/curves/secp256k1
- **LNURL-first strategy**: genera invoices via LNURL primero (incluye Zap request), NWC como fallback
- **Verificación dual paralela**: Zap receipt monitor (WebSocket en browser) + NWC lookupInvoice (polling en server)
- **Staff Attendee List**: lista de asistentes con búsqueda en tiempo real en panel Staff
- **Banner de pago verificado**: scroll-margin-top para visibilidad correcta con sticky header
- **Pruebas completas**: pagos, verificación, QR, staff scanner, buscador, entrada, consumición — TODO OK

## Métricas del trabajo

| Métrica | v1 | v3.3 | Cambio |
|---------|----|----|--------|
| Líneas de código (app) | ~900 | ~3500+ | +289% |
| Líneas de test | 0 | ~1200 | nuevo |
| Pantallas | 4 | 7 | +75% |
| NIPs implementados | 0 | 2 (NIP-47, NIP-57) | nuevo |
| Unit tests | 0 | 56 | nuevo |
| Security tests | 0 | 48 (22+26) | nuevo |
| Total test scenarios | 0 | 104 | nuevo |
| Verificación de pago | Manual | Automática dual (Zap receipt + NWC) | upgrade |
| Pagos | Demo only | Reales (producción) | upgrade |
| Backend | Client-side | Serverless (Vercel Functions) | upgrade |
| Staff verification | No | QR scanner + attendee list + PIN | nuevo |
| Wallets compatibles | 0 | 3+ (Primal/Alby/Mutiny) | nuevo |
| Vulnerabilidades | ~17 | 2 (arquitectónicas) | -88% |
| Rondas de pentest | 0 | 4 | nuevo |
| Registro de pagos | Sin hash | Payment hash + preimage + Zap receipt en Nostr | upgrade |
| Verificación pública | No | Página pública + links Nostr (njump.me) | nuevo |
| Exportación de datos | No | CSV sanitizado con audit trail | nuevo |
| Documentación de seguridad | No | Reporte formal con CVSS | nuevo |

## Protocolos implementados

### NIP-47 (Nostr Wallet Connect)
- Conexión automática via `nostr+walletconnect://` URI (NWC URL en env vars server-side)
- `makeInvoice` para crear invoices (fallback si LNURL falla)
- `lookupInvoice` con polling para verificar pagos (canal secundario en verificación dual)
- `getBalance` para mostrar balance en el panel del organizador
- Normalización robusta de respuestas: `paymentRequest`/`payment_request`/`invoice`/`bolt11`, `preimage`/`payment_preimage`, `settled_at`/`settledAt`/`state`/`status`

### LNURL-pay (Primary — LNURL-first strategy, v3.3)
- Método principal para generar invoices (no fallback)
- Resolve Lightning Address → fetch callback → request invoice con Zap request
- Incluye parámetro `nostr` con kind 9734 firmado (Schnorr/BIP-340) para habilitar Zap receipts
- Decodificación bolt11 custom para extraer payment_hash sin relay

### NIP-57 (Zaps — registro público + verificación de pagos)
- Kind 9734 (Zap Request): firmado server-side con Schnorr, incluido en LNURL callback
- Kind 9735 (Zap Receipt): publicado por wallet, usado para verificación automática de pagos
- Publicación en relay.damus.io, nos.lol, relay.primal.net
- **Verificación dual**: browser se suscribe a kind 9735 en relays públicos via WebSocket — detecta pago al instante sin depender del relay NWC

### Schnorr Signatures (BIP-340)
- Firma de Zap requests server-side con @noble/curves/secp256k1
- Key derivation determinística desde seed string via SHA-256
- Verificable por cualquier cliente Nostr

## Seguridad

Se ejecutaron **4 rondas de pentesting** con **48+ escenarios** en 21+ categorías:
- Replay attacks, localStorage injection, invoice manipulation
- DOM XSS, prototype pollution, supply chain attacks
- CSV formula injection, brute force, cross-event leakage
- Clickjacking, CSP bypass, crypto weaknesses, rate limiting
- Staff PIN timing attacks, unsigned ticket forgery, error message info leak

De 17 vulnerabilidades iniciales → 4 rondas de fixes → **2 restantes** (limitaciones arquitectónicas: SRI hashes, window scope).

**0 CRITICAL, 0 HIGH** en la versión actual.

Reporte completo con clasificación CVSS: `SECURITY-AUDIT.md`

## Stack técnico

- Frontend: Vite + HTML/JS vanilla (single-file ~3500+ líneas)
- Backend: Vercel Serverless Functions (3 endpoints)
- NWC: @getalby/sdk v3.5.1 (importado via esm.sh, version pinned)
- Nostr: nostr-tools v2.7 (firma y publicación de eventos NIP-57)
- Schnorr: @noble/curves/secp256k1 (firmas BIP-340 para Zap requests)
- Crypto: @noble/hashes + Web Crypto API (AES-256-GCM, CSPRNG, SHA-256)
- Server crypto: Node crypto (HMAC-SHA256, timingSafeEqual)
- QR: qrcode v1.5.3 + html5-qrcode (scanner)
- Precio: mempool.space API (BTC→USD en tiempo real)

## Cómo evaluar

1. **App live**: https://proof-of-attendance-hdmp.vercel.app — probar flujo completo de reserva y pago
2. `npm install && npm run dev` — Correr localmente
3. `npm run test:all` — Correr los 104 escenarios de testing
4. **Staff panel**: pestaña 🔑 Staff → PIN `1234` → escanear QR o buscar asistentes
5. **Verificación pública**: abrir link `#verify/HDMP-XXXXXXXX` de cualquier ticket
6. Revisar `SECURITY-AUDIT.md` para el reporte formal de seguridad
7. Revisar `CHANGELOG.md` para la evolución detallada por versión
8. Revisar commit history (`git log --oneline`) para ver la progresión v1 → v3.3
